import { Img } from '@react-email/components';
import { text, ui } from '../theme.ts';

/** Only images hosted on hummlist.com: every remote load in a mail reveals the reader's IP. */
export type HummlistImage = `https://hummlist.com/${string}.png`;

/**
 * A phone screen in the 6b navy frame, centred, fixed width. Demo data only (fixture households,
 * never real lists). `alt` is required and shown in the frame when images are blocked, so say
 * what the screen shows. `src` is a PNG at 2x of `width` x `height`.
 */
export function PhoneScreenshot({ src, alt, width = 240, height }: { src: HummlistImage; alt: string; width?: number; height: number }) {
  if (!alt.trim()) throw new Error('PhoneScreenshot needs alt text that says what the screen shows');
  const bezel = ui.space[2];
  return (
    <table role="presentation" align="center" cellPadding={0} cellSpacing={0} border={0} style={{ margin: `${ui.space[2]}px auto ${ui.space[5]}px auto` }}>
      <tbody>
        <tr>
          <td bgcolor={ui.light.ink} style={{ backgroundColor: ui.light.ink, padding: bezel, borderRadius: ui.radius.l, boxShadow: `0 ${ui.depth.edge}px 0 ${ui.light.ink}` }}>
            <table role="presentation" cellPadding={0} cellSpacing={0} border={0}>
              <tbody>
                <tr>
                  <td width={width} height={height} align="center" valign="middle" bgcolor={ui.light.surface}
                    style={{ width, height, backgroundColor: ui.light.surface, borderRadius: ui.radius.l - bezel, overflow: 'hidden' }}>
                    <Img src={src} alt={alt} width={width} height={height}
                      style={{ display: 'block', width, height, border: 0, borderRadius: ui.radius.l - bezel, ...text.muted, margin: 0, textAlign: 'center' }} />
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
