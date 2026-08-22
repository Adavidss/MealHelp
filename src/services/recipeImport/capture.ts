import type { RecipeDraft } from '@/models'
import { fromSchemaNode } from './jsonLd'
import { parseRecipeText } from './parseText'
import { RecipeImportError } from './types'

/**
 * Capturing a recipe from the page you are already looking at.
 *
 * This is the only route that works on every site, and it works because it
 * sidesteps the whole problem: the browser has already loaded and rendered the
 * page, so there is no cross-origin request to refuse and no robot to turn
 * away. A small script reads the recipe out of the page and hands it to
 * MealHelp through a link.
 *
 * Only the fields MealHelp reads are carried, which is what keeps a 700 KB page
 * down to a link of a couple of thousand characters.
 */

/** Bumped if the payload shape changes, so an old link fails loudly. */
const CAPTURE_VERSION = 1

export interface CapturePayload {
  v: number
  /** Schema.org Recipe fields, trimmed to what the parser reads. */
  r?: Record<string, unknown>
  /** Plain text, when the page had no structured data. */
  t?: string
  /** Page URL and title, for attribution. */
  u?: string
  n?: string
}

/** Percent-encoding safe for a URL fragment, and safe for non-ASCII text. */
export function encodeCapture(payload: CapturePayload): string {
  const json = JSON.stringify(payload)
  const bytes = new TextEncoder().encode(json)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeCapture(encoded: string): CapturePayload {
  let payload: CapturePayload
  try {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(base64)
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    payload = JSON.parse(new TextDecoder().decode(bytes)) as CapturePayload
  } catch {
    throw new RecipeImportError(
      'unsupported',
      'That link could not be read — it may have been cut short on the way here.',
      'Try the capture again, or paste the recipe text instead.',
    )
  }

  if (payload.v !== CAPTURE_VERSION) {
    throw new RecipeImportError(
      'unsupported',
      'That link came from a different version of the MealHelp button.',
      'Set the button up again from Import.',
    )
  }
  return payload
}

export interface CaptureResult {
  draft: RecipeDraft
  warnings: string[]
}

/** Turns a captured payload into a draft for the usual preview screen. */
export function captureToDraft(payload: CapturePayload): CaptureResult {
  if (payload.r) {
    const parsed = fromSchemaNode(payload.r, undefined, payload.u)
    return { draft: parsed.draft, warnings: parsed.warnings }
  }

  if (payload.t) {
    const parsed = parseRecipeText(payload.t, payload.u)
    return {
      draft: { ...parsed.draft, sourceName: payload.n ?? parsed.draft.sourceName },
      warnings: [
        'That page had no structured recipe data, so MealHelp read the visible text.',
        ...parsed.warnings,
      ],
    }
  }

  throw new RecipeImportError(
    'no-recipe',
    'That capture arrived empty.',
    'Try again on the recipe page itself, or paste the text instead.',
  )
}

/**
 * The script that runs on the recipe page.
 *
 * Kept deliberately small and dependency-free: it is pasted into a bookmark or
 * an iOS Shortcut, so every character is one the user has to carry around. It
 * prefers the page's Schema.org data and falls back to the visible text, which
 * between them covers sites with and without proper recipe markup.
 */
export function buildCaptureScript(appUrl: string): string {
  return `(function(){
var KEEP=['name','description','image','author','recipeYield','prepTime','cookTime','totalTime','recipeIngredient','recipeInstructions','keywords','recipeCategory','nutrition'];
function findRecipe(n,d){if(!n||typeof n!=='object'||d>6)return null;
if(Array.isArray(n)){for(var i=0;i<n.length;i++){var f=findRecipe(n[i],d+1);if(f)return f}return null}
var t=[].concat(n['@type']||[]);for(var j=0;j<t.length;j++){if(String(t[j]).toLowerCase()==='recipe')return n}
var keys=['@graph','mainEntity','mainEntityOfPage','itemListElement'];
for(var k=0;k<keys.length;k++){if(n[keys[k]]){var g=findRecipe(n[keys[k]],d+1);if(g)return g}}return null}
var node=null,s=document.querySelectorAll('script[type="application/ld+json"]');
for(var i=0;i<s.length&&!node;i++){try{node=findRecipe(JSON.parse(s[i].textContent),0)}catch(e){}}
var p={v:${CAPTURE_VERSION},u:location.href,n:location.hostname.replace(/^www\\./,'')};
if(node){var slim={};for(var m=0;m<KEEP.length;m++){if(node[KEEP[m]]!==undefined)slim[KEEP[m]]=node[KEEP[m]]}p.r=slim}
else{var c=document.querySelector('[itemprop="recipeIngredient"]')?document.body:(document.querySelector('article,main,[class*=recipe]')||document.body);
p.t=(document.title+'\\n'+(c.innerText||'')).slice(0,20000)}
var b=new TextEncoder().encode(JSON.stringify(p)),bin='';
for(var q=0;q<b.length;q++)bin+=String.fromCharCode(b[q]);
var e=btoa(bin).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'');
var url='${appUrl}#/capture/'+e;
if(url.length>28000){alert('This recipe is too long to send in a link. Copy the recipe text and paste it into MealHelp instead.');return}
window.open(url,'_blank')||(location.href=url)})()`
    .replace(/\n/g, '')
}

/** The same script as a `javascript:` bookmark. */
export function buildBookmarklet(appUrl: string): string {
  return `javascript:${encodeURIComponent(buildCaptureScript(appUrl))}`
}

/** Where the app lives, for building a capture link back to it. */
export function currentAppUrl(): string {
  if (typeof window === 'undefined') return 'https://kidsdc.org/MealHelp/'
  return `${window.location.origin}${window.location.pathname}`
}
