/**
 * Stylised flags drawn in SVG (emoji flags do not render on every platform).
 * Unknown codes fall back to a neutral chip with the code.
 */
import { memo } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

type Spec =
  | { h: string[] }
  | { v: string[] }
  | { nordic: [string, string] }
  | { custom: 'GRE' | 'ISR' | 'DOM' | 'MNE' | 'BAH' | 'GBR' | 'AUS' | 'CAN' | 'GEO' | 'JPN' | 'KOR' | 'BRA' | 'USA' | 'ENG' | 'SCO' | 'SUI' | 'MAR' | 'ALG' | 'TUN' | 'CMR' | 'GHA' | 'SEN' | 'CRO' | 'SRB' | 'POR' | 'URU' | 'ARG' | 'TUR' };

const FLAGS: Record<string, Spec> = {
  FRA: { v: ['#1F3C88', '#F4F4F4', '#D5263B'] },
  ITA: { v: ['#1E8A4C', '#F4F4F4', '#CE2B37'] },
  BEL: { v: ['#111', '#F8D11E', '#E1262D'] },
  IRL: { v: ['#169B62', '#F4F4F4', '#FF883E'] },
  CIV: { v: ['#F77F00', '#F4F4F4', '#009E60'] },
  NGA: { v: ['#0A8754', '#F4F4F4', '#0A8754'] },
  MLI: { v: ['#14B53A', '#FCD116', '#CE1126'] },
  GER: { h: ['#111', '#DD0000', '#FFCE00'] },
  AUT: { h: ['#C8102E', '#F4F4F4', '#C8102E'] },
  NED: { h: ['#AE1C28', '#F4F4F4', '#21468B'] },
  ESP: { h: ['#AA151B', '#F1BF00', '#F1BF00', '#AA151B'] },
  COL: { h: ['#FCD116', '#FCD116', '#003893', '#CE1126'] },
  POL: { h: ['#F4F4F4', '#DC143C'] },
  HUN: { h: ['#CE2939', '#F4F4F4', '#477050'] },
  LTU: { h: ['#FDB913', '#006A44', '#C1272D'] },
  LAT: { h: ['#9E3039', '#9E3039', '#F4F4F4', '#9E3039', '#9E3039'] },
  FIN: { nordic: ['#F4F4F4', '#003580'] },
  GRE: { custom: 'GRE' },
  ISR: { custom: 'ISR' },
  DOM: { custom: 'DOM' },
  MNE: { custom: 'MNE' },
  BAH: { custom: 'BAH' },
  GBR: { custom: 'GBR' },
  AUS: { custom: 'AUS' },
  SVN: { h: ['#F4F4F4', '#0057B8', '#ED1C24'] },
  SVK: { h: ['#F4F4F4', '#0B4EA2', '#EE1C25'] },
  ECU: { h: ['#FFD100', '#FFD100', '#034EA2', '#ED1C24'] },
  EGY: { h: ['#CE1126', '#F4F4F4', '#111111'] },
  GUI: { v: ['#CE1126', '#FCD116', '#009460'] },
  CAN: { custom: 'CAN' },
  GEO: { custom: 'GEO' },
  DEN: { nordic: ['#C8102E', '#F4F4F4'] },
  NOR: { nordic: ['#BA0C2F', '#F4F4F4'] },
  SWE: { nordic: ['#006AA7', '#FECC00'] },
  JPN: { custom: 'JPN' },
  KOR: { custom: 'KOR' },
  BRA: { custom: 'BRA' },
  USA: { custom: 'USA' },
  ENG: { custom: 'ENG' },
  SCO: { custom: 'SCO' },
  SUI: { custom: 'SUI' },
  MAR: { custom: 'MAR' },
  ALG: { custom: 'ALG' },
  TUN: { custom: 'TUN' },
  CMR: { custom: 'CMR' },
  GHA: { custom: 'GHA' },
  SEN: { custom: 'SEN' },
  CRO: { custom: 'CRO' },
  SRB: { custom: 'SRB' },
  POR: { custom: 'POR' },
  URU: { custom: 'URU' },
  ARG: { custom: 'ARG' },
  TUR: { custom: 'TUR' },
};

function Custom({ code }: { code: string }) {
  switch (code) {
    case 'GRE':
      return (<>{[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (<Rect key={i} y={i * (20 / 9)} width="30" height={20 / 9} fill={i % 2 ? '#F4F4F4' : '#0D5EAF'} />))}<Rect width="11.1" height="11.1" fill="#0D5EAF" /><Rect x="4.44" width="2.22" height="11.1" fill="#F4F4F4" /><Rect y="4.44" width="11.1" height="2.22" fill="#F4F4F4" /></>);
    case 'ISR':
      return (<><Rect width="30" height="20" fill="#F4F4F4" /><Rect y="2.5" width="30" height="2.6" fill="#0038B8" /><Rect y="14.9" width="30" height="2.6" fill="#0038B8" /><Path d="M15 6.6l3 5.2h-6zM15 13.4l-3-5.2h6z" fill="none" stroke="#0038B8" strokeWidth="0.9" /></>);
    case 'DOM':
      return (<><Rect width="30" height="20" fill="#F4F4F4" /><Rect width="13" height="8.5" fill="#002D62" /><Rect x="17" width="13" height="8.5" fill="#CE1126" /><Rect y="11.5" width="13" height="8.5" fill="#CE1126" /><Rect x="17" y="11.5" width="13" height="8.5" fill="#002D62" /></>);
    case 'MNE':
      return (<><Rect width="30" height="20" fill="#D4AF37" /><Rect x="1.2" y="1.2" width="27.6" height="17.6" fill="#C40308" /><Circle cx="15" cy="10" r="3.2" fill="#D4AF37" /></>);
    case 'BAH':
      return (<><Rect width="30" height="20" fill="#00778B" /><Rect y="6.67" width="30" height="6.67" fill="#FFC72C" /><Path d="M0 0 L11 10 L0 20 Z" fill="#111" /></>);
    case 'GBR':
      return (<><Rect width="30" height="20" fill="#012169" /><Path d="M0 0 30 20M30 0 0 20" stroke="#F4F4F4" strokeWidth="4" /><Path d="M0 0 30 20M30 0 0 20" stroke="#C8102E" strokeWidth="1.6" /><Rect x="12" width="6" height="20" fill="#F4F4F4" /><Rect y="7" width="30" height="6" fill="#F4F4F4" /><Rect x="13.3" width="3.4" height="20" fill="#C8102E" /><Rect y="8.3" width="30" height="3.4" fill="#C8102E" /></>);
    case 'AUS':
      return (<><Rect width="30" height="20" fill="#012169" /><Rect width="15" height="10" fill="#012169" /><Path d="M0 0 15 10M15 0 0 10" stroke="#F4F4F4" strokeWidth="2" /><Rect x="6" width="3" height="10" fill="#F4F4F4" /><Rect y="3.5" width="15" height="3" fill="#F4F4F4" /><Rect x="6.8" width="1.4" height="10" fill="#C8102E" /><Rect y="4.3" width="15" height="1.4" fill="#C8102E" /><Circle cx="7.5" cy="15" r="1.6" fill="#F4F4F4" /><Circle cx="23" cy="5" r="0.9" fill="#F4F4F4" /><Circle cx="20" cy="10" r="0.9" fill="#F4F4F4" /><Circle cx="25.5" cy="9" r="0.9" fill="#F4F4F4" /><Circle cx="23" cy="16" r="0.9" fill="#F4F4F4" /></>);
    case 'CAN':
      return (<><Rect width="30" height="20" fill="#F4F4F4" /><Rect width="7.5" height="20" fill="#D52B1E" /><Rect x="22.5" width="7.5" height="20" fill="#D52B1E" /><Path d="M15 5l1.2 2.6 1.6-.6-.5 3 1.7-1-.3 1.6 1.4.3-1.6 1.8.3 1.1h-3.2v2.2h-1.2v-2.2h-3.2l.3-1.1-1.6-1.8 1.4-.3-.3-1.6 1.7 1-.5-3 1.6.6z" fill="#D52B1E" /></>);
    case 'GEO':
      return (<><Rect width="30" height="20" fill="#F4F4F4" /><Rect x="13" width="4" height="20" fill="#E8112D" /><Rect y="8" width="30" height="4" fill="#E8112D" />{[[6, 4], [24, 4], [6, 16], [24, 16]].map(([x, y], i) => (<Path key={i} d={`M${x! - 1.6} ${y} H${x! + 1.6} M${x} ${y! - 1.6} V${y! + 1.6}`} stroke="#E8112D" strokeWidth="1.2" />))}</>);
    case 'JPN':
      return (<><Rect width="30" height="20" fill="#F4F4F4" /><Circle cx="15" cy="10" r="5.5" fill="#BC002D" /></>);
    case 'KOR':
      return (<><Rect width="30" height="20" fill="#F4F4F4" /><Path d="M9.5 10a5.5 5.5 0 0 1 11 0z" fill="#CD2E3A" /><Path d="M9.5 10a5.5 5.5 0 0 0 11 0z" fill="#0047A0" /></>);
    case 'BRA':
      return (<><Rect width="30" height="20" fill="#009C3B" /><Path d="M15 2.5 27 10 15 17.5 3 10z" fill="#FFDF00" /><Circle cx="15" cy="10" r="4.4" fill="#002776" /></>);
    case 'USA':
      return (<>{[0, 1, 2, 3, 4, 5, 6].map((i) => (<Rect key={i} y={i * (20 / 7)} width="30" height={20 / 7} fill={i % 2 ? '#F4F4F4' : '#B22234'} />))}<Rect width="13" height="10.8" fill="#3C3B6E" /></>);
    case 'ENG':
      return (<><Rect width="30" height="20" fill="#F4F4F4" /><Rect x="12.5" width="5" height="20" fill="#CE1124" /><Rect y="7.5" width="30" height="5" fill="#CE1124" /></>);
    case 'SCO':
      return (<><Rect width="30" height="20" fill="#005EB8" /><Path d="M0 0 30 20M30 0 0 20" stroke="#F4F4F4" strokeWidth="3.5" /></>);
    case 'SUI':
      return (<><Rect width="30" height="20" fill="#DA291C" /><Rect x="13" y="4" width="4" height="12" fill="#F4F4F4" /><Rect x="9" y="8" width="12" height="4" fill="#F4F4F4" /></>);
    case 'MAR':
      return (<><Rect width="30" height="20" fill="#C1272D" /><Path d="M15 5.5l1.3 4h4.2l-3.4 2.5 1.3 4L15 13.5l-3.4 2.5 1.3-4-3.4-2.5h4.2z" fill="none" stroke="#006233" strokeWidth="1.1" /></>);
    case 'ALG':
      return (<><Rect width="15" height="20" fill="#006233" /><Rect x="15" width="15" height="20" fill="#F4F4F4" /><Circle cx="15" cy="10" r="4.6" fill="#D21034" /><Circle cx="16.4" cy="10" r="3.8" fill="#F4F4F4" /></>);
    case 'TUN':
      return (<><Rect width="30" height="20" fill="#E70013" /><Circle cx="15" cy="10" r="5.2" fill="#F4F4F4" /><Circle cx="15" cy="10" r="3.6" fill="#E70013" /><Circle cx="16.2" cy="10" r="3" fill="#F4F4F4" /></>);
    case 'CMR':
      return (<><Rect width="10" height="20" fill="#007A5E" /><Rect x="10" width="10" height="20" fill="#CE1126" /><Rect x="20" width="10" height="20" fill="#FCD116" /></>);
    case 'GHA':
      return (<><Rect width="30" height="6.67" fill="#CE1126" /><Rect y="6.67" width="30" height="6.67" fill="#FCD116" /><Rect y="13.33" width="30" height="6.67" fill="#006B3F" /><Circle cx="15" cy="10" r="2.3" fill="#111" /></>);
    case 'SEN':
      return (<><Rect width="10" height="20" fill="#00853F" /><Rect x="10" width="10" height="20" fill="#FDEF42" /><Rect x="20" width="10" height="20" fill="#E31B23" /><Circle cx="15" cy="10" r="2.2" fill="#00853F" /></>);
    case 'CRO':
      return (<><Rect width="30" height="6.67" fill="#FF0000" /><Rect y="6.67" width="30" height="6.67" fill="#F4F4F4" /><Rect y="13.33" width="30" height="6.67" fill="#171796" />{[0, 1, 2, 3].map((i) => (<Rect key={i} x={12 + (i % 2) * 3} y={6 + Math.floor(i / 2) * 3} width="3" height="3" fill={i === 0 || i === 3 ? '#FF0000' : '#F4F4F4'} />))}</>);
    case 'SRB':
      return (<><Rect width="30" height="6.67" fill="#C6363C" /><Rect y="6.67" width="30" height="6.67" fill="#0C4076" /><Rect y="13.33" width="30" height="6.67" fill="#F4F4F4" /></>);
    case 'POR':
      return (<><Rect width="12" height="20" fill="#046A38" /><Rect x="12" width="18" height="20" fill="#DA291C" /><Circle cx="12" cy="10" r="3.4" fill="#FFE900" /></>);
    case 'URU':
      return (<>{[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (<Rect key={i} y={i * (20 / 9)} width="30" height={20 / 9} fill={i % 2 ? '#0038A8' : '#F4F4F4'} />))}<Rect width="11" height="11.1" fill="#F4F4F4" /><Circle cx="5.5" cy="5.5" r="2.6" fill="#FCD116" /></>);
    case 'ARG':
      return (<><Rect width="30" height="20" fill="#74ACDF" /><Rect y="6.67" width="30" height="6.67" fill="#F4F4F4" /><Circle cx="15" cy="10" r="2" fill="#F6B40E" /></>);
    case 'TUR':
      return (<><Rect width="30" height="20" fill="#E30A17" /><Circle cx="12" cy="10" r="5" fill="#F4F4F4" /><Circle cx="13.3" cy="10" r="4" fill="#E30A17" /></>);
    default:
      return null;
  }
}

export const Flag = memo(function Flag({ code, width }: { code: string; width: number }) {
  const spec = FLAGS[code];
  const height = (width * 2) / 3;
  if (!spec) {
    return (
      <View style={{ width, height, borderRadius: 2, backgroundColor: '#2A3440', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#C9D2DA', fontSize: height * 0.5, fontWeight: '700' }}>{code.slice(0, 3)}</Text>
      </View>
    );
  }
  return (
    <Svg width={width} height={height} viewBox="0 0 30 20" style={{ borderRadius: 2 }}>
      {'h' in spec && spec.h.map((c, i) => <Rect key={i} y={(20 / spec.h.length) * i} width="30" height={20 / spec.h.length} fill={c} />)}
      {'v' in spec && spec.v.map((c, i) => <Rect key={i} x={(30 / spec.v.length) * i} width={30 / spec.v.length} height="20" fill={c} />)}
      {'nordic' in spec && (
        <>
          <Rect width="30" height="20" fill={spec.nordic[0]} />
          <Rect x="8" width="4" height="20" fill={spec.nordic[1]} />
          <Rect y="8" width="30" height="4" fill={spec.nordic[1]} />
        </>
      )}
      {'custom' in spec && <Custom code={spec.custom} />}
      <Rect width="30" height="20" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" />
    </Svg>
  );
});
