import { Img } from '@react-email/components';
import { text, ui } from '../theme.ts';

export const LOGO_URL = 'https://hummlist.com/email/hummlist-icon-96.png';
const LOGO = ui.space[7];

/**
 * App icon #5 and the "Hummlist" wordmark as live text. The icon's alt is empty because the
 * wordmark next to it already says the name; with images blocked the slot keeps its size and
 * the brand colour, so the header still reads as logo plus name.
 */
export function Header() {
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} border={0} data-skip-in-text="true" style={{ margin: `0 0 ${ui.space[4]}px 0` }}>
      <tbody>
        <tr>
          <td width={LOGO} height={LOGO} bgcolor={ui.light.brand} style={{ width: LOGO, height: LOGO, backgroundColor: ui.light.brand, borderRadius: ui.radius.s }}>
            <Img src={LOGO_URL} width={LOGO} height={LOGO} alt="" style={{ display: 'block', width: LOGO, height: LOGO, border: 0, borderRadius: ui.radius.s }} />
          </td>
          <td className="hl-text" style={{ ...text.wordmark, paddingLeft: ui.space[3] }}>Hummlist</td>
        </tr>
      </tbody>
    </table>
  );
}
