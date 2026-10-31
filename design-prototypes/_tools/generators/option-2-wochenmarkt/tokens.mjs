import { writeFileSync } from 'node:fs';
const OUT='/workspace/hummlist/research/design-prototypes/option-2-wochenmarkt/tokens.json';
const L={brand:['#34552a','Forest olive. Brand fills, quantities, links.'],'on-brand':['#fbf6ec'],'brand-container':['#e1e5cc','Pale sage wash for selected tabs and chips.'],'on-brand-container':['#2a4320'],accent:['#7c2948','Beetroot. Stamps, the sync thread, small emphasis; one use per view.'],'on-accent':['#fbf2f4'],highlight:['#e8b847','Mustard. Status dots, the bee, Alexa prompts on chalk; never body text on paper.'],'on-highlight':['#2a2119'],surface:['#f5efe3','Cream paper. Page and app background.'],'surface-raised':['#fffbf4','Fresh sheet. Cards, phone screen, email body.'],'surface-sunken':['#ece3d2','Pressed paper. Input pill, footer, code.'],kraft:['#dcc49c','Kraft paper tags for categories and labels.'],'on-kraft':['#3b2d1d'],chalk:['#27322a','Chalkboard. One dark band per page, Alexa card.'],'on-chalk':['#f2ead9'],text:['#2a2119','Espresso ink.'],'text-muted':['#66594a','Faded ink. Secondary lines and category dividers.'],border:['#ddd0bb','Hairline rules (decorative, not a UI boundary).'],'border-strong':['#8c7b65','UI boundaries (inputs, outlined buttons), 3:1.'],success:['#3c6a2c'],'on-success':['#fbf6ec'],warning:['#8a5a00'],'on-warning':['#fffaf2'],error:['#a8321e'],'on-error':['#fffaf2']};
const D={brand:'#b3c98f','on-brand':'#1c2812','brand-container':'#334425','on-brand-container':'#d6e3bf',accent:'#e7a1bb','on-accent':'#2b0b17',highlight:'#e3b64c','on-highlight':'#241a08',surface:'#1c1712','surface-raised':'#272019','surface-sunken':'#14100c',kraft:'#3d3123','on-kraft':'#ecd9b8',chalk:'#232c25','on-chalk':'#efe6d4',text:'#f2e9da','text-muted':'#c1b29c',border:'#463b2f','border-strong':'#8f806c',success:'#b3c98f','on-success':'#1c2812',warning:'#e3b64c','on-warning':'#241a08',error:'#f2a08c','on-error':'#3a0f06'};
const col=(m,isL)=>Object.fromEntries(Object.entries(m).map(([k,v])=>[k,isL?{$value:v[0],...(v[1]?{$description:v[1]}:{})}:{$value:v}]));
const px=v=>({value:v,unit:'px'}), rem=v=>({value:v,unit:'rem'}), em=v=>({value:v,unit:'em'});
const ty=(fam,size,w,lh,tr,d)=>({$value:{fontFamily:`{font.family.${fam}}`,fontSize:rem(size),fontWeight:w,lineHeight:lh,letterSpacing:em(tr)},$description:d});
const sh=(...layers)=>({$value:layers.map(([x,y,b,s,c])=>({color:c,offsetX:px(x),offsetY:px(y),blur:px(b),spread:px(s)}))});
const t={
 $description:'Wochenmarkt: warm and editorial, like a good market stall and a well-made food magazine. Cream paper, forest green, beetroot and mustard, Fraunces with Figtree.',
 $extensions:{'com.hummlist':{option:'option-2-wochenmarkt',
  contrastPairs:[['brand','surface',4.5],['brand','surface-raised',4.5],['brand','surface-sunken',4.5],['accent','surface',4.5],['accent','surface-raised',4.5],['text','surface-sunken',4.5],['text-muted','surface-sunken',4.5],['on-brand-container','brand-container',4.5],['on-highlight','highlight',4.5],['on-kraft','kraft',4.5],['on-chalk','chalk',4.5],['highlight','chalk',3],['border-strong','surface',3],['border-strong','surface-raised',3]],
  fraunces:'Display text sets font-variation-settings "SOFT" 100, "WONK" 0 and lets opsz follow the size (font-optical-sizing: auto). Flutter: FontVariation(\'SOFT\', 100).'}},
 color:{light:{$type:'color',...col(L,true)},dark:{$type:'color',...col(D,false)}},
 font:{family:{$type:'fontFamily',
   serif:{$value:['Fraunces Variable','Fraunces','Iowan Old Style','Georgia','serif'],$description:'Display, headlines, household and store names only.',$extensions:{'com.hummlist':{license:'OFL-1.1',source:'@fontsource-variable/fraunces 5.3.0 (undercasetype/Fraunces, Google Fonts)',files:'fonts/fraunces-latin-full-normal.woff2, fonts/fraunces-latin-full-italic.woff2 (axes opsz, wght, SOFT, WONK)'}}},
   sans:{$value:['Figtree Variable','Figtree','Segoe UI','Helvetica Neue','Arial','sans-serif'],$description:'UI, rows, body, labels.',$extensions:{'com.hummlist':{license:'OFL-1.1',source:'@fontsource-variable/figtree 5.3.0 (erikdkennedy/figtree, Google Fonts)',files:'fonts/figtree-latin-wght-normal.woff2'}}}},
  weight:{$type:'fontWeight',book:{$value:340},regular:{$value:400},medium:{$value:500},semibold:{$value:600},bold:{$value:700}}},
 type:{$type:'typography',
  display:ty('serif',5,360,1.0,-0.025,'Hero headline. Fraunces at opsz 144, soft.'),
  headline:ty('serif',2.375,400,1.08,-0.018,'Section headlines.'),
  title:ty('serif',1.5,480,1.2,-0.01,'Card titles, household name, store names.'),
  lead:ty('sans',1.25,400,1.5,-0.005,'Subline under a headline.'),
  body:ty('sans',1.0625,400,1.6,0,'Running text.'),
  row:ty('sans',1.125,500,1.3,-0.005,'App list item name.'),
  label:ty('sans',0.9375,600,1.25,0.005,'Buttons, tabs, links in UI.'),
  overline:ty('sans',0.75,700,1.2,0.14,'Uppercase category dividers and kickers.'),
  caption:ty('sans',0.8125,450,1.45,0.01,'Second lines, footnotes.')},
 space:{$type:'dimension',...Object.fromEntries([2,4,8,12,16,24,32,48,64,96,128].map((v,i)=>[String(i),{$value:px(v)}]))},
 radius:{$type:'dimension',xs:{$value:px(4),$description:'Tags, badges'},s:{$value:px(6),$description:'Buttons, swatches'},m:{$value:px(10),$description:'Cards'},l:{$value:px(14),$description:'Sheets, large panels'},phone:{$value:px(38),$description:'Device frame only'},full:{$value:px(999),$description:'Input pill, plus disc'}},
 shadow:{$type:'shadow',
  '1':{...sh([0,1,0,0,'#5a3c1414'],[0,1,3,0,'#5a3c1412']),$description:'Paper resting on paper.'},
  '2':{...sh([0,2,4,-1,'#5a3c141a'],[0,10,24,-8,'#5a3c1426']),$description:'Lifted sheet, cards on hover.'},
  '3':{...sh([0,4,10,-2,'#3a26101f'],[0,30,60,-20,'#3a261040']),$description:'Phone mock, sheets.'}},
 motion:{duration:{$type:'duration',quick:{$value:{value:220,unit:'ms'},$description:'Hover, focus, tick'},calm:{$value:{value:320,unit:'ms'},$description:'Rows settling, snackbar'},slow:{$value:{value:420,unit:'ms'},$description:'Sheets, page reveals'}},
  easing:{$type:'cubicBezier',settle:{$value:[0.22,0.61,0.36,1],$description:'Gentle ease-out, default'},glide:{$value:[0.33,0,0.15,1],$description:'Sheets and larger moves'},exit:{$value:[0.5,0,0.75,0.2],$description:'Leaving the screen'}}}
};
writeFileSync(OUT, JSON.stringify(t,null,2)+'\n');
