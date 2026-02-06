import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { presetRtl, resetRtlWarnings } from '../../uno-preset-rtl'
import { createGenerator, presetWind4 } from 'unocss'

describe('uno-preset-rtl', () => {
  let warnSpy: MockInstance

  beforeEach(() => {
    resetRtlWarnings()
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  it('rtl rules replace css styles correctly', async () => {
    const uno = await createGenerator({
      presets: [presetWind4(), presetRtl()],
    })

    const { css } = await uno.generate(
      'left-0 right-0 pl-1 ml-1 pr-1 mr-1 text-left text-right border-l border-r rounded-l rounded-r sm:pl-2 hover:text-right position-left-4',
    )

    expect(css).toMatchInlineSnapshot(`
    	"/* layer: theme */
    	:root, :host { --spacing: 0.25rem; --font-sans: ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji"; --font-mono: ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace; --default-font-family: var(--font-sans); --default-monoFont-family: var(--font-mono); }
    	/* layer: base */
    	 *, ::after, ::before, ::backdrop, ::file-selector-button { box-sizing: border-box;  margin: 0;  padding: 0;  border: 0 solid;  }  html, :host { line-height: 1.5;  -webkit-text-size-adjust: 100%;  tab-size: 4;  font-family: var( --default-font-family, ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji' );  font-feature-settings: var(--default-font-featureSettings, normal);  font-variation-settings: var(--default-font-variationSettings, normal);  -webkit-tap-highlight-color: transparent;  }  hr { height: 0;  color: inherit;  border-top-width: 1px;  }  abbr:where([title]) { -webkit-text-decoration: underline dotted; text-decoration: underline dotted; }  h1, h2, h3, h4, h5, h6 { font-size: inherit; font-weight: inherit; }  a { color: inherit; -webkit-text-decoration: inherit; text-decoration: inherit; }  b, strong { font-weight: bolder; }  code, kbd, samp, pre { font-family: var( --default-monoFont-family, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace );  font-feature-settings: var(--default-monoFont-featureSettings, normal);  font-variation-settings: var(--default-monoFont-variationSettings, normal);  font-size: 1em;  }  small { font-size: 80%; }  sub, sup { font-size: 75%; line-height: 0; position: relative; vertical-align: baseline; } sub { bottom: -0.25em; } sup { top: -0.5em; }  table { text-indent: 0;  border-color: inherit;  border-collapse: collapse;  }  :-moz-focusring { outline: auto; }  progress { vertical-align: baseline; }  summary { display: list-item; }  ol, ul, menu { list-style: none; }  img, svg, video, canvas, audio, iframe, embed, object { display: block;  vertical-align: middle;  }  img, video { max-width: 100%; height: auto; }  button, input, select, optgroup, textarea, ::file-selector-button { font: inherit;  font-feature-settings: inherit;  font-variation-settings: inherit;  letter-spacing: inherit;  color: inherit;  border-radius: 0;  background-color: transparent;  opacity: 1;  }  :where(select:is([multiple], [size])) optgroup { font-weight: bolder; }  :where(select:is([multiple], [size])) optgroup option { padding-inline-start: 20px; }  ::file-selector-button { margin-inline-end: 4px; }  ::placeholder { opacity: 1; }  @supports (not (-webkit-appearance: -apple-pay-button))  or (contain-intrinsic-size: 1px)  { ::placeholder { color: color-mix(in oklab, currentcolor 50%, transparent); } }  textarea { resize: vertical; }  ::-webkit-search-decoration { -webkit-appearance: none; }  ::-webkit-date-and-time-value { min-height: 1lh;  text-align: inherit;  }  ::-webkit-datetime-edit { display: inline-flex; }  ::-webkit-datetime-edit-fields-wrapper { padding: 0; } ::-webkit-datetime-edit, ::-webkit-datetime-edit-year-field, ::-webkit-datetime-edit-month-field, ::-webkit-datetime-edit-day-field, ::-webkit-datetime-edit-hour-field, ::-webkit-datetime-edit-minute-field, ::-webkit-datetime-edit-second-field, ::-webkit-datetime-edit-millisecond-field, ::-webkit-datetime-edit-meridiem-field { padding-block: 0; }  ::-webkit-calendar-picker-indicator { line-height: 1; }  :-moz-ui-invalid { box-shadow: none; }  button, input:where([type='button'], [type='reset'], [type='submit']), ::file-selector-button { appearance: button; }  ::-webkit-inner-spin-button, ::-webkit-outer-spin-button { height: auto; }  [hidden]:where(:not([hidden~='until-found'])) { display: none !important; }
    	/* layer: default */
    	.text-left{text-align:left;}
    	.text-right{text-align:right;}
    	.hover\\:text-right:hover{text-align:right;}
    	.pl-1{padding-inline-start:calc(var(--spacing) * 1);}
    	.pr-1{padding-inline-end:calc(var(--spacing) * 1);}
    	.ml-1{margin-inline-start:calc(var(--spacing) * 1);}
    	.mr-1{margin-inline-end:calc(var(--spacing) * 1);}
    	.left-0{inset-inline-start:calc(var(--spacing) * 0);}
    	.position-left-4{inset-inline-start:calc(var(--spacing) * 4);}
    	.right-0{inset-inline-end:calc(var(--spacing) * 0);}
    	.rounded-l{border-end-start-radius:0.25rem;border-start-start-radius:0.25rem;}
    	.rounded-r{border-start-end-radius:0.25rem;border-end-end-radius:0.25rem;}
    	.border-l{border-inline-start-width:1px;}
    	.border-r{border-inline-end-width:1px;}
    	@media (min-width: 40rem){
    	.sm\\:pl-2{padding-inline-start:calc(var(--spacing) * 2);}
    	}"
    `)

    const warnings = warnSpy.mock.calls.flat()
    expect(warnings).toMatchInlineSnapshot(`
    	[
    	  "[RTL] Avoid using 'left-0'. Use 'inset-is-0' instead.",
    	  "[RTL] Avoid using 'right-0'. Use 'inset-ie-0' instead.",
    	  "[RTL] Avoid using 'pl-1'. Use 'ps-1' instead.",
    	  "[RTL] Avoid using 'ml-1'. Use 'ms-1' instead.",
    	  "[RTL] Avoid using 'pr-1'. Use 'pe-1' instead.",
    	  "[RTL] Avoid using 'mr-1'. Use 'me-1' instead.",
    	  "[RTL] Avoid using 'border-l'. Use 'border-is' instead.",
    	  "[RTL] Avoid using 'border-r'. Use 'border-ie' instead.",
    	  "[RTL] Avoid using 'rounded-l'. Use 'rounded-is' instead.",
    	  "[RTL] Avoid using 'rounded-r'. Use 'rounded-ie' instead.",
    	  "[RTL] Avoid using 'position-left-4'. Use 'inset-is-4' instead.",
    	  "[RTL] Avoid using 'sm:pl-2'. Use 'sm:ps-2' instead.",
    	]
    `)
  })
})
