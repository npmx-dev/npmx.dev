import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { presetRtl } from '../../uno-preset-rtl'
import { createGenerator } from 'unocss'

describe('uno-preset-rtl', () => {
  let warnSpy: MockInstance

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  it('rtl rules replace css styles correctly', async () => {
    const uno = await createGenerator({
      presets: [presetRtl()],
    })

    const { css } = await uno.generate(
      'left-0 right-0 pl-1 ml-1 pr-1 mr-1 text-left text-right border-l border-r rounded-l rounded-r',
    )

    expect(css).toMatchInlineSnapshot(`
        	"/* layer: default */
        	.pl-1{padding-inline-start:calc(var(--spacing) * 1);}
        	.pr-1{padding-inline-end:calc(var(--spacing) * 1);}
        	.ml-1{margin-inline-start:calc(var(--spacing) * 1);}
        	.mr-1{margin-inline-end:calc(var(--spacing) * 1);}
        	.left-0{inset-inline-start:calc(var(--spacing) * 0);}
        	.right-0{inset-inline-end:calc(var(--spacing) * 0);}
        	.text-left{text-align:start;}
        	.text-right{text-align:end;}
        	.border-l{border-inline-start-width:1px;}
        	.border-r{border-inline-end-width:1px;}"
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
        	  "[RTL] Avoid using 'text-left'. Use 'text-start' instead.",
        	  "[RTL] Avoid using 'text-right'. Use 'text-end' instead.",
        	  "[RTL] Avoid using 'border-l'. Use 'border-is' instead.",
        	  "[RTL] Avoid using 'border-r'. Use 'border-ie' instead.",
        	  "[RTL] Avoid using 'rounded-l'. Use 'rounded-is' instead.",
        	  "[RTL] Avoid using 'rounded-r'. Use 'rounded-ie' instead.",
        	]
        `)
  })
})
