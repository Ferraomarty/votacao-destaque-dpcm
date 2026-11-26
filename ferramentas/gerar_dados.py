import openpyxl, json, re, sys
wb=openpyxl.load_workbook(sys.argv[1]); ws=wb.active
SEC={
 'DEPARTAMENTO DE ADMINISTRACAO E FINANCAS':('daf','Departamento de Administração e Finanças','DAF',True),
 'DEPARTAMENTO DE RECURSOS HUMANOS':('drh','Departamento de Recursos Humanos','DRH',False),
 'DEPARTAMENTO DE PESQUISA, FORMAÇÃO E INQUÉRITOS DE SAÚDE':('dpfis','Departamento de Pesquisa, Formação e Inquéritos de Saúde','DPFIS',True),
 'Unidade Gestora Executora de Aquisições':('ugea','Unidade Gestora Executora de Aquisições','UGEA',False),
 'CENTRO DE INVESTIGAÇÃO EM SAÚDE DE POLANA CANIÇO':('cispoc','Centro de Investigação em Saúde de Polana Caniço','CISPOC',True),
 'UPT MACHAVA':('machava','UPT Machava','UPT Machava',True),
 'UPT MAVALANE':('mavalane','UPT Mavalane','UPT Mavalane',True),
 'UNIDADE DE GESTÃO DE DADOS':('ugd','Unidade de Gestão de Dados','UGD',True),
}
setores=[];cur=None
for r in range(2,ws.max_row+1):
  a=ws.cell(r,1).value; b=ws.cell(r,2)
  if isinstance(a,str) and a.strip() in SEC:
    sid,nome,curto,part=SEC[a.strip()]
    cur={'id':sid,'nome':nome,'curto':curto,'participa':part,'pessoas':[]}; setores.append(cur); continue
  if not b.value or cur is None: continue
  f=b.fill.fgColor
  chefe = b.fill.fill_type=='solid' and f.type=='rgb' and f.rgb=='FFFFFF00'
  n=len(cur['pessoas'])+1
  cur['pessoas'].append({'id':f"{cur['id']}{n:02d}",'nome':re.sub(r'\s+',' ',str(b.value)).strip(),
     'categoria':re.sub(r'\s+',' ',str(ws.cell(r,4).value or '')).strip(),'chefe':chefe})
for s in setores:
  print(s['curto'],len(s['pessoas']),'chefes',sum(p['chefe'] for p in s['pessoas']),'participa',s['participa'],file=sys.stderr)
js="/* Lista de pessoal da DPCM. Gerado a partir de Lista_de_pessoal_DPCM_jr.xlsx.\n   chefe:true = nome pintado a amarelo na lista. participa:false = sector fora da votação. */\nwindow.SETORES = "+json.dumps(setores,ensure_ascii=False,indent=1)+";\n"
open(sys.argv[2],'w').write(js)
