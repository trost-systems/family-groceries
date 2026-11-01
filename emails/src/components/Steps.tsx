import type { ReactNode } from 'react';
import { text, ui } from '../theme.ts';

export type Step = { title: string; children: ReactNode };
/** Two to four steps. One step is a paragraph, five is a manual; both fail to type-check. */
export type StepList = [Step, Step] | [Step, Step, Step] | [Step, Step, Step, Step];

const BADGE = ui.space[6];

/**
 * Numbered steps: a yellow number badge with the navy contour, a bold title, then the step's
 * content (paragraphs, at most one PrimaryButton in the whole mail). Plain text: "1. Title".
 */
export function Steps({ steps }: { steps: StepList }) {
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0} style={{ margin: `0 0 ${ui.space[2]}px 0` }}>
      <tbody>
        {steps.map((step, i) => (
          <tr key={step.title}>
            <td width={BADGE + ui.space[3]} valign="top" data-skip-in-text="true" style={{ width: BADGE + ui.space[3], paddingBottom: ui.space[4] }}>
              <table role="presentation" cellPadding={0} cellSpacing={0} border={0}>
                <tbody>
                  <tr>
                    <td width={BADGE} height={BADGE} align="center" valign="middle" bgcolor={ui.light.honey} className="hl-honey"
                      style={{
                        width: BADGE - 2 * ui.border.width, height: BADGE - 2 * ui.border.width, backgroundColor: ui.light.honey,
                        border: `${ui.border.width}px solid ${ui.light.ink}`, borderRadius: ui.radius.full,
                        fontFamily: ui.font.display, fontSize: `${ui.typography.label.size}px`, fontWeight: ui.weight.heavy,
                        lineHeight: `${BADGE - 2 * ui.border.width}px`, color: ui.light['on-honey'], textAlign: 'center',
                      }}>
                      {i + 1}
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
            <td valign="top" style={{ paddingBottom: ui.space[1] }}>
              <p className="hl-text" data-hl-step={i + 1} style={text.stepTitle}>{step.title}</p>
              {step.children}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
