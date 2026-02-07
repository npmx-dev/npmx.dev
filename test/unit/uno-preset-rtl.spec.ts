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
    	/* layer: shortcuts */
    	.text-left{text-align:start;--x-rtl-start:"text-left -> text-start";}
    	.text-right{text-align:end;--x-rtl-end:"text-right -> text-end";}
    	.hover\\:text-right:hover{text-align:end;--x-rtl-end:"hover:text-right -> hover:text-end";}
    	/* layer: default */
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
    	  "[RTL] Avoid using 'left-0', use 'inset-is-0' instead, or 'force-left-0' to keep physical direction.",
    	  "[RTL] Avoid using 'right-0', use 'inset-ie-0' instead, or 'force-right-0' to keep physical direction.",
    	  "[RTL] Avoid using 'pl-1', use 'ps-1' instead, or 'force-pl-1' to keep physical direction.",
    	  "[RTL] Avoid using 'ml-1', use 'ms-1' instead, or 'force-ml-1' to keep physical direction.",
    	  "[RTL] Avoid using 'pr-1', use 'pe-1' instead, or 'force-pr-1' to keep physical direction.",
    	  "[RTL] Avoid using 'mr-1', use 'me-1' instead, or 'force-mr-1' to keep physical direction.",
    	  "[RTL] Avoid using 'border-l', use 'border-is' instead, or 'force-border-l' to keep physical direction.",
    	  "[RTL] Avoid using 'border-r', use 'border-ie' instead, or 'force-border-r' to keep physical direction.",
    	  "[RTL] Avoid using 'rounded-l', use 'rounded-is' instead, or 'force-rounded-l' to keep physical direction.",
    	  "[RTL] Avoid using 'rounded-r', use 'rounded-ie' instead, or 'force-rounded-r' to keep physical direction.",
    	  "[RTL] Avoid using 'position-left-4', use 'inset-is-4' instead, or 'force-position-left-4' to keep physical direction.",
    	  "[RTL] Avoid using 'sm:pl-2', use 'sm:ps-2' instead, or 'force-sm:pl-2' to keep physical direction.",
    	  "[RTL] Avoid using 'text-left', use 'text-start' instead, or 'force-text-left' to keep physical direction.",
    	  "[RTL] Avoid using 'text-right', use 'text-end' instead, or 'force-text-right' to keep physical direction.",
    	  "[RTL] Avoid using 'hover:text-right', use 'hover:text-end' instead, or 'force-hover:text-right' to keep physical direction.",
    	]
    `)
  })

  it('force-* (non rtl rules) use original css styles correctly', async () => {
    const uno = await createGenerator({
      presets: [presetWind4(), presetRtl()],
    })

    const { css } = await uno.generate(
      'force-left-0 force-right-0 force-pl-1 force-ml-1 force-pr-1 force-mr-1 force-text-left force-text-right force-border-l force-border-r force-rounded-l force-rounded-r sm:force-pl-2 hover:force-text-right force-position-left-4',
    )

    expect(css).toMatchInlineSnapshot(`
    	"/* layer: theme */
    	:root, :host { --font-sans: ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji"; --font-mono: ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace; --default-font-family: var(--font-sans); --default-monoFont-family: var(--font-mono); }
    	/* layer: base */
    	 *, ::after, ::before, ::backdrop, ::file-selector-button { box-sizing: border-box;  margin: 0;  padding: 0;  border: 0 solid;  }  html, :host { line-height: 1.5;  -webkit-text-size-adjust: 100%;  tab-size: 4;  font-family: var( --default-font-family, ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji' );  font-feature-settings: var(--default-font-featureSettings, normal);  font-variation-settings: var(--default-font-variationSettings, normal);  -webkit-tap-highlight-color: transparent;  }  hr { height: 0;  color: inherit;  border-top-width: 1px;  }  abbr:where([title]) { -webkit-text-decoration: underline dotted; text-decoration: underline dotted; }  h1, h2, h3, h4, h5, h6 { font-size: inherit; font-weight: inherit; }  a { color: inherit; -webkit-text-decoration: inherit; text-decoration: inherit; }  b, strong { font-weight: bolder; }  code, kbd, samp, pre { font-family: var( --default-monoFont-family, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace );  font-feature-settings: var(--default-monoFont-featureSettings, normal);  font-variation-settings: var(--default-monoFont-variationSettings, normal);  font-size: 1em;  }  small { font-size: 80%; }  sub, sup { font-size: 75%; line-height: 0; position: relative; vertical-align: baseline; } sub { bottom: -0.25em; } sup { top: -0.5em; }  table { text-indent: 0;  border-color: inherit;  border-collapse: collapse;  }  :-moz-focusring { outline: auto; }  progress { vertical-align: baseline; }  summary { display: list-item; }  ol, ul, menu { list-style: none; }  img, svg, video, canvas, audio, iframe, embed, object { display: block;  vertical-align: middle;  }  img, video { max-width: 100%; height: auto; }  button, input, select, optgroup, textarea, ::file-selector-button { font: inherit;  font-feature-settings: inherit;  font-variation-settings: inherit;  letter-spacing: inherit;  color: inherit;  border-radius: 0;  background-color: transparent;  opacity: 1;  }  :where(select:is([multiple], [size])) optgroup { font-weight: bolder; }  :where(select:is([multiple], [size])) optgroup option { padding-inline-start: 20px; }  ::file-selector-button { margin-inline-end: 4px; }  ::placeholder { opacity: 1; }  @supports (not (-webkit-appearance: -apple-pay-button))  or (contain-intrinsic-size: 1px)  { ::placeholder { color: color-mix(in oklab, currentcolor 50%, transparent); } }  textarea { resize: vertical; }  ::-webkit-search-decoration { -webkit-appearance: none; }  ::-webkit-date-and-time-value { min-height: 1lh;  text-align: inherit;  }  ::-webkit-datetime-edit { display: inline-flex; }  ::-webkit-datetime-edit-fields-wrapper { padding: 0; } ::-webkit-datetime-edit, ::-webkit-datetime-edit-year-field, ::-webkit-datetime-edit-month-field, ::-webkit-datetime-edit-day-field, ::-webkit-datetime-edit-hour-field, ::-webkit-datetime-edit-minute-field, ::-webkit-datetime-edit-second-field, ::-webkit-datetime-edit-millisecond-field, ::-webkit-datetime-edit-meridiem-field { padding-block: 0; }  ::-webkit-calendar-picker-indicator { line-height: 1; }  :-moz-ui-invalid { box-shadow: none; }  button, input:where([type='button'], [type='reset'], [type='submit']), ::file-selector-button { appearance: button; }  ::-webkit-inner-spin-button, ::-webkit-outer-spin-button { height: auto; }  [hidden]:where(:not([hidden~='until-found'])) { display: none !important; }
    	/* layer: default */
    	.force-pl-1{padding-left:0.25rem;}
    	.force-pr-1{padding-right:0.25rem;}
    	.force-ml-1{margin-left:0.25rem;}
    	.force-mr-1{margin-right:0.25rem;}
    	.force-left-0{left:0;}
    	.force-position-left-4{left:1rem;}
    	.force-right-0{right:0;}
    	.force-text-left{text-align:left;}
    	.force-text-right{text-align:right;}
    	.hover\\:force-text-right:hover{text-align:right;}
    	.force-rounded-l{border-top-left-radius:0.25rem;border-bottom-left-radius:0.25rem;}
    	.force-rounded-r{border-top-right-radius:0.25rem;border-bottom-right-radius:0.25rem;}
    	.force-border-l{border-left-width:1px;}
    	.force-border-r{border-right-width:1px;}
    	@media (min-width: 40rem){
    	.sm\\:force-pl-2{padding-left:0.5rem;}
    	}"
    `)

    const warnings = warnSpy.mock.calls.flat()
    expect(warnings).toMatchInlineSnapshot(`[]`)
  })
})
