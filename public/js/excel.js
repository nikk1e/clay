/**
 * Collection of Excel manipulation functions
 *
 */

 ;(function(base){

var Cube = base.Cube;

function mixin(obj, mix) {
	for (var k in mix) {
		obj[k] = mix[k];
	}
}

function FindSheetInBook(wb, sheetName){
	var v = XLSX.readSheet(wb,'xl/Workbook.xml');
	var s = v.match(/\<sheets\>.*\<\/sheets\>/g)[0];
	var sheets = xmlToJSON.parseString(s.replace(/\:/g,'_')).sheets[0].sheet; //Doesnt like colon in attr

	var name = undefined;
	sheets.forEach(function(sheet){
		if(sheetName.toLowerCase() == sheet._attr.name._value.toLowerCase())
			name = 'xl/worksheets/sheet' + sheet._attr.r_id._value.replace('rId','') + '.xml';
	});
	return name;
}

function _Sheet(headers, rows, keyCount, params){
	function addCell(elem,row,col){
		if((elem==undefined||elem==null))
			elem = '';

		var cell = {v:elem};

		if(typeof cell.v === 'number') {
			if(isNaN(cell.v)){
				cell.v = '';
				cell.t = 's';
			}
			else {
				cell.t = 'n';
				cell.w = elem.toLocaleString();
			}
		}
		else if(typeof cell.v === 'boolean') cell.t = 'b';
		else if(cell.v instanceof Date) {
			cell.t = 'n'; cell.z = XLSX.SSF._table[14];
			cell.v = datenum(cell.v);
		}
		else cell.t = 's';
		cell_ref = XLSX.utils.encode_cell({c:col,r:row});
		ws[cell_ref] = cell;		
	}	

	var header = boolean(params.header, true);
	var rOffset = header ? 1 : 0;
	var cell_ref = params.startCell || 'A1';
	var start_pos = XLSX.utils.decode_cell(cell_ref);
	var ws = { };
	var colWidths = [{wch:20}]; 

	if(header){		
		headers = (params.headers || headers);
		headers.forEach(function(val,i){
			addCell(val,0,i);
		});
	}

	var i = start_pos.r;
	var c = start_pos.c;
	rows.forEach(function(r){
		if(boolean(params.skipEmptyRows,false)){
			var nonKeys = r.slice(keyCount);
			if(!nonKeys.every(function(elem){
				return elem == undefined;
			})){
				r.forEach(function(e,j){
					addCell(e,i+rOffset,j+c);
				});
				i++;		
			}
		} else {			
			r.forEach(function(e,j){
				addCell(e,i+rOffset,j+c);
			});
			i++;
		}
	});

	ws['!ref'] = 'A1:'+cell_ref;
	ws['!cols'] = colWidths;
	return ws;
}

function boolean(val, fallback){
	if(typeof val === 'boolean') return val;
	if(typeof val === 'number') {
		if(val % 1 == 0 && val <= 1 && val >= 0){
			return Boolean(val);
		}
	}
	if(val != undefined){
		var str = val.toLowerCase();
		if(str == "true" || str == "1") return true;
		if(str == "false" || str == "0") return false;
	}
	return fallback;
}

function SheetNames(wb){
	var v = XLSX.readSheet(wb,'xl/Workbook.xml');
	var s = v.match(/\<sheets\>.*\<\/sheets\>/g)[0];
	var sheets = xmlToJSON.parseString(s.replace(/\:/g,'___')).sheets[0].sheet; //Doesnt like colon in attr

	var names = [];
	sheets.forEach(function(sheet){
		names.push(sheet._attr.name._value);
	});
	return names;
}

function FindSheetInBook(wb, sheetName){
	var v = XLSX.readSheet(wb,'xl/Workbook.xml');
	var s = v.match(/\<sheets\>.*\<\/sheets\>/g)[0];
	var sheets = xmlToJSON.parseString(s.replace(/\:/g,'_')).sheets[0].sheet; //Doesnt like colon in attr

	var name = undefined;
	sheets.forEach(function(sheet){
		if(sheetName.toLowerCase() == sheet._attr.name._value.toLowerCase())
			name = 'xl/worksheets/sheet' + sheet._attr.r_id._value.replace('rId','') + '.xml';
	});
	return name;
}

function ClearWorkbookCache(wb){
	//If cell has a <f>, remove the <v>, should cause Excel to recalc on open
	var sheetNames = SheetNames(wb);
	var fnReg = RegExp(/<f/); //Function

	sheetNames.forEach(function(sheet){
		var alias = FindSheetInBook(wb, sheet);
		var data = XLSX.readSheet(wb, alias);
		var cells = data.match(/\<c.+?\<\/c\>/g); //Cell

		if(cells != null){
			var changed = false;
			for(var i=0,j=cells.length;i<j;++i){
				if(fnReg.test(cells[i])){
					var exValue = cells[i].replace(/\<v.*\<\/v\>/,''); //Replace the value tag + contents with nothing
					data = data.replace(cells[i], exValue);
					changed = true;
				}
			}			
			//If you've changed something re-attach the data
			if(changed) wb.files[alias]._data = StringToUint8Array(data);
		}
	});

	return wb;
}

function ReplaceSheetData(wb, sheetName, data, range){
	var sheet = XLSX.readSheet(wb, sheetName);
	sheet = sheet.replace(/\<sheetData\/\>/g, data); //Replace an empty data tag
	sheet = sheet.replace(/\<sheetData.*sheetData\>/g, data);
	sheet = sheet.replace(/\<dimension ref="[\w\d:]*"\/\>/g, range);
	return sheet;
}

function StringToArrayBuffer(s) {
	var ab = new ArrayBuffer(s.length);
	var view = new Uint8Array(ab);
	for (var i=0; i!=s.length; ++i) 
		view[i] = s.charCodeAt(i) & 0xFF;
	return ab;
}

function StringToUint8Array(s){
	var uint = new Uint8Array(s.length);
	for(var i=0,j=s.length;i<j;++i)
	  uint[i]=s.charCodeAt(i);	
	return uint;
}

function ArrayBufferToBinaryString(ab) {
	var data = new Uint8Array(ab);
	var arr = new Array();
	for(var i=0; i!=data.length; ++i)
		arr[i] = String.fromCharCode(data[i]);	
	return arr.join("");
}

READING = {}; //sentinal
function ReadWorkbook(url){
	var oReq = new XMLHttpRequest();
	var cache = cube.sessionCache();
	var data = cache[url];
	if (data === undefined || !data.hasOwnProperty('files')) {
		cache[url] = READING;

		oReq.onload = function(e) {
			var bstr = ArrayBufferToBinaryString(oReq.response);	
			data = new JSZip(bstr, { base64:false });
			cache[url] = data;			
		}

		oReq.onerror = function() {
			cache[url] = new Error("Timeout while reading data");
		}

		oReq.open("GET", url, true);
		oReq.responseType = "arraybuffer";
		oReq.send();
	}	
	
	//if (data === READING) throw "Read pending...";
	if (data instanceof Error) throw data;
	return data;
}

function Workbook(sheets){
	var wopts = { bookType:'xlsx', bookSST:false, type:'binary' };
	var wb = { SheetNames:[], Sheets:{} };

	for(var prop in sheets){
		if(sheets.hasOwnProperty(prop)){
			wb.SheetNames.push(prop);
			wb.Sheets[prop] = sheets[prop];
		}
	}
	return StringToArrayBuffer(XLSX.write(wb, wopts));	
}

function fetchXlsxTemplate(templateName){
	var url = '../../../templates/' + templateName;			
	ReadWorkbook(url);
}

function xlsx(sheets, templateName){	
	var wb = Workbook(sheets);
	var source = new JSZip(wb, { base64:false });	

	//If a template is specified and has returned from the async properly, use it...
	if(templateName != undefined){
		var url = '../../../templates/' + templateName;			
		var target = ReadWorkbook(url) || {};

		if(target.hasOwnProperty('files')){			
			var sheetNames = SheetNames(source);
			//If you find the sheetname in the template, switch out the data
			sheetNames.forEach(function(sheetName){
				var tLocation = FindSheetInBook(target, sheetName);
				if (tLocation === undefined){
					//TODO: Add it as a new sheet to the book
				} else {
					var targetName = FindSheetInBook(source, sheetName);
					var sheet = XLSX.readSheet(source, targetName);

					var sheetData = sheet.match(/\<sheetData.*sheetData\>/gm)[0];
					var dataRange = /\<dimension ref="([\w\d:]*)"\/\>/gm.exec(sheet);

					//If it has a datatable replace the range
					var sheetAlias = tLocation.match(/([A-z0-9]*)\.xml/)[1];
					var dataTableName = 'xl/worksheets/_rels/' + sheetAlias + '.xml.rels';
					if(target.files.hasOwnProperty(dataTableName)){
						var tab = XLSX.readSheet(target, dataTableName);
						var tableXml = tab.match(/[a-z0-9]*\.xml/g)[0];
						var tableData = XLSX.readSheet(target,'xl/tables/'+tableXml);

						tableData = tableData.replace(/ref\=\"[A-z0-9:]*\"/gm,"ref=\""+dataRange[1]+"\"");
						tableData = tableData.replace(/<sort.*State>/,"");

						target.files['xl/tables/'+tableXml]._data = StringToUint8Array(tableData);
					}					

					var rep = ReplaceSheetData(target, tLocation, sheetData, dataRange[0]);					
					target.files[tLocation]._data = StringToUint8Array(rep);
				}
			});
			
			target = ClearWorkbookCache(target);
			var buff = StringToArrayBuffer(target.generate({type:"string"}));
			return buff;
		}
	} else {
		return wb;
	}

	return undefined;		
}	

var funcList = 	{ _Sheet:_Sheet, xlsx:xlsx, fetchXlsxTemplate:fetchXlsxTemplate };

mixin(Cube.Functions, funcList);

}(this || (typeof window !== 'undefined' ? window : global)));