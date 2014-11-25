/*

INVARIANTS

* Must have newline and cell separator characters as
  you can place a cursor either side of them.

  -- separators (they are not part of either the cell or the paragraph)

* Don\'t have to split on newline characters. Can put attributes into the document
  to say what they are.

*/

var text = 'WM FXRates\nExtract the WM Rates from the nozzle API. \nWMDataCall = Data("http://uss-lon-apps1dv/Nozzle/api/Data/FireHose/Jsonp",{"query"="select [ï»¿Identifier] as Id, Date, P from [WMRates.nozzle]"})\nDice the data up into cubes, needed as the data is without structure at this point.\nRow[] = range(Count(WMDataCall))\nWMRateData[Row] = WMDataCall\nWM Ccy = dot("Id", WMRateData)\nWM Data = dot("P", WMRateData) \nJust filter down to the latest rates (the last data point is the latest date).\nFX Rates = Last(WM Data[Row, WM Ccy == WM Code])\nForward FX Rates = Last(WM Data[Row, WM Ccy == WM One Month Forward Code])\nWe need to ensure that GBP has a rate of 1\nFX Rates[Ccy="GBP"] = 1\nForward FX Rates[Ccy="GBP"] = 1 \nWM Mapping Codes\nCcy=\tWM Code[]\tWM One Month Forward Code[]\tDescription\nAUD\tAUSTDOL\tUKAUD1M\tAustralian Dollar to United Kingdom Sterling (WMR)\nBRL\tBRACRUZ\tUKBRL1M\tBrazilian Real to United Kingdom Sterling (WMR)\nCAD\tCNDOLLR\tUKCAD1M\tCanadian Dollar to United Kingdom Sterling (WMR)\nCLP\tCHILPES\tUKCLP1M\tChilean Peso to United Kingdom Sterling (WMR)\n'+
           'COP\tCOLUPES\tUKCOP1M\tColombian Peso to United Kingdom Sterling (WMR)\nCNY\tCHIYUAN\tUKCNY1M\tChinese Yuan to United Kingdom Sterling (WMR)\nCZK\tCZECHCM\tUKCZK1M\tCzech Koruna to United Kingdom Sterling (WMR)\nDKK\tDANISHK\tUKDKK1M\tDanish Krone to United Kingdom Sterling (WMR)\nEUR\tEURSTER\tUKXEU1F\tEuro to United Kingdom Sterling (WMR and DS)\nEGP\tEGYPTNP\tUKEGP1M\tEgyptian Pound to United Kingdom Sterling (WMR)\nHKD\tHKDOLLR\tUKHKD1M\tHong Kong Dollar to United Kingdom Sterling (WMR)\nHUF\tHUNFORT\tUKHUF1M\tHungarian Forint to United Kingdom Sterling (WMR)\nINR\tINDRUPE\tUKINR1M\tIndian Rupee to United Kingdom Sterling (WMR)\nIDR\tINDORUP\tUKIDR1M\tIndonesian Rupiah to United Kingdom Sterling (WMR)\nILS\tISRSHEK\tUKILS1M\tIsraeli Shekel to United Kingdom Sterling (WMR)\nJPY\tJAPAYEN\tUKJPY1M\tJapanese Yen to United Kingdom Sterling (WMR)\nMYR\tMALADLR\tUKMYR1M\tMalaysian Ringgit to United Kingdom Sterling (WMR)\nMXN\tMEXPESO\tUKMXN1M\tMexican Peso to United Kingdom Sterling (WMR)\nMAD\tMOROCDM\tUKMAD1M\tMoroccan Dirham to United Kingdom Sterling (WMR)\n'+
           'NZD\tNZDOLLR\tUKNZD1M\tNew Zealand Dollar to United Kingdom Sterling (WMR)\nNOK\tNORKRON\tUKNOK1M\tNorwegian Krone to United Kingdom Sterling (WMR)\nPHP\tPHILPES\tUKPHP1M\tPhilippine Peso to United Kingdom Sterling (WMR)\nPLN\tPOLZLOT\tUKPLN1M\tPolish Zloty to United Kingdom Sterling (WMR)\nQAR\tQATARIA\tUKQAR1M\tQatari Rial to United Kingdom Sterling (WMR)\nRUB\tCISRUBM\tUKRUB1M\tRussian Rouble to United Kingdom Sterling (WMR)\nSGD\tSINGDOL\tUKSGD1M\tSingapore$ to United Kingdom Sterling (WMR)\nZAR\tCOMRAND\tUKZAR1M\tSouth Africa Rand to United Kingdom Sterling (WMR)\nKRW\tKORSWON\tUKKRW1M\tSouth Korean Won to United Kingdom Sterling (WMR)\nSEK\tSWEKRON\tUKSEK1M\tSwedish Krona to United Kingdom Sterling (WMR)\nCHF\tSWISSFR\tUKCHF1M\tSwiss Franc to United Kingdom Sterling (WMR)\nTWD\tTAIWDOL\tUKTWD1M\tTaiwan New$ to United Kingdom Sterling (WMR)\nTHB\tTHABAHT\tUKTHB1M\tThai Baht to United Kingdom Sterling (WMR)\nTRY\tTURKLIR\tUKTRY1M\tNew Turkish Lira to United Kingdom Sterling (WMR)\nAED\tUAEDIRM\tUKAED1M\tUnited Arab Emirates Dirham to United Kingdom Sterling (WMR)\n'+
           'RON\tROMALEU\tUKRON1M\tNew Romanian Leu to United Kingdom Sterling (WMR)\nNGN\tNIGNAIM\tUKNGN1M\tNigerian Naira to United Kingdom Sterling (WMR)\nPEN\tPERUSOL\tUKPEN1M\tPeruvian Nuevo Sol to United Kingdom Sterling (WMR)\nCNH\tCNHGBPS\tUKCNH1M\tChinese Yuan HK CNH to United Kingdom Sterling (WMR)\nKZT\tKAZAKH£\tUKKZT1M\tKazakhstan Tenge to United Kingdom Sterling (WMR)\nUSD\tUSDOLLR\tUKUSD1M\tUnited States Dollar to United Kingdom Sterling (WMR)\nGBP\tGBP\tGBP\tUK to UK\n//Check\nChecks\nStats=\tCheck[]\nCount of FX rates\t= Count(FX Rates[Ccy])\nCount of forward FX rates\t= Count(Forward FX Rates[Ccy])\nimport(ChalkFXRates) \nChalkFXRates.Ccy = Ccy\nChalk FX Rates = ChalkFXRates.FX Rates\nUnused WM codes (add to main table as required)\nUnused WM Code\tDescription\nALBNLEK\tAlbanian Lek to United Kingdom Sterling (WMR)\nALGRNDN\tAlgerian Dinar to United Kingdom Sterling (WMR)\nANGORWZ\tAngolan Kwanza to United Kingdom Sterling (WMR)\nANTGEC$\tAntiguan East Caribb$ to United Kingdom Sterling (WMR)\nARGPESO\tArgentine Peso to United Kingdom Sterling (WMR)\n'+
           'ARUBFLR\tAruban Florin to United Kingdom Sterling (WMR)\nAUSTSCH\tAustrian Schilling to United Kingdom Sterling (WMR)\nAZERMAN\tNew Azerbaijan Manat to United Kingdom Sterling (WMR)\nBAHAMA$\tBahamas Dollar to United Kingdom Sterling (WMR)\nBAHRDIN\tBahraini Dinar to United Kingdom Sterling (WMR)\nBANTAKA\tBangladesh Taka to United Kingdom Sterling (WMR)\nBARBAD$\tBarbados$ to United Kingdom Sterling (WMR)\nBELARUK\tBelarus Rouble to United Kingdom Sterling (WMR)\nBELGLUX\tBelgian Franc to United Kingdom Sterling (WMR)\nBERMDOL\tBermudan Dollar to United Kingdom Sterling (WMR)\nBHUTNLM\tBhutan Ngultrum to United Kingdom Sterling (WMR)\nBOLIPES\tBolivian Boliviano to United Kingdom Sterling (WMR)\nBOSHERC\tBosnia Hercegovinian to United Kingdom Sterling (WMR)\nBOTSWPU\tBotswanan Pula to United Kingdom Sterling (WMR)\nBULGLEV\tBulgarian Lev to United Kingdom Sterling (WMR)\nBURUDFR\tBurundi Franc to United Kingdom Sterling (WMR)\nCHIYUAN\tChinese Yuan to United Kingdom Sterling (WMR)\nCOMOCFA\tComoran Franc to United Kingdom Sterling (WMR)\nZAIRERP\tCongo (DRC) Franc to United Kingdom Sterling (WMR)\n'+
           'CRICACN\tCosta Rican Colon to United Kingdom Sterling (WMR)\nCDIVCFA\tCote D\'Ivoire CFA Franc to United Kingdom Sterling (WMR)\nCROATKN\tCroatian Kuna to United Kingdom Sterling (WMR)\nCUBPESO\tCuban Peso to United Kingdom Sterling (WMR)\nCYPRUSP\tCyprus £ to United Kingdom Sterling (WMR)\nDOMPESO\tDominican Republic Peso to United Kingdom Sterling (WMR)\nECURRSP\tEuro to United Kingdom Sterling (ECU History WMR)EUR\nECUASRE\tEcuador Sucre to United Kingdom Sterling (WMR)\nELSALVA\tEl Salvador Colon to United Kingdom Sterling (WMR)\nESTOKRN\tEstonian Kroon to United Kingdom Sterling (WMR)\nETHIOPB\tEthiopian Birr to United Kingdom Sterling (WMR)\nFIJILD$\tFijian Dollar to United Kingdom Sterling (WMR)\nFINMARK\tFinnish Markka to United Kingdom Sterling (WMR)\nFRENFRA\tFrench Franc to United Kingdom Sterling (WMR)\nFRPACIF\tFrench Pacific CFP to United Kingdom Sterling (WMR)\nGAMBDLI\tGambian Dalasi to United Kingdom Sterling (WMR)\nGEOLARI\tGeorgian Lari to United Kingdom Sterling (WMR)\nDMARKER\tGerman Mark to United Kingdom Sterling (WMR)\nGHANCED\tGhanaian Cedi to United Kingdom Sterling (WMR)\n'+
           'GREDRAC\tGreek Drachma to United Kingdom Sterling (WMR)\nGUATQTL\tGuatemala Quetzal to United Kingdom Sterling (WMR)\nGUINEAF\tGuinea Franc to United Kingdom Sterling (WMR)\nHAITIGD\tHaitian Gourde to United Kingdom Sterling (WMR)\nHONDLPA\tHonduras Lempira to United Kingdom Sterling (WMR)\nICEKRON\tIcelandic Krona to United Kingdom Sterling (WMR)\nIPUNTER\tIrish Punt to United Kingdom Sterling (WMR)\nITALIRE\tItalian Lira to United Kingdom Sterling (WMR)\nJAMDOLL\tJamaican$ to United Kingdom Sterling (WMR)\nJORDINA\tJordanian Dinar to United Kingdom Sterling (WMR)\nKAZAKH£\tKazakhstan Tenge to United Kingdom Sterling (WMR)\nKENSHIL\tKenyan Shilling to United Kingdom Sterling (WMR)\nKUWADIN\tKuwaiti Dinar to United Kingdom Sterling (WMR)\nKYRGYZS\tKyrgyz Som to United Kingdom Sterling (WMR)\nLATVLAT\tLatvian Lat to United Kingdom Sterling (WMR)\nLEBANE£\tLebanese £ to United Kingdom Sterling (WMR)\nLESOMAI\tLesotho Maloti to United Kingdom Sterling (WMR)\nLIBRDOL\tLiberian$ to United Kingdom Sterling\nLITITAS\tLithuanian Lita to United Kingdom Sterling (WMR)\n'+
           'FINLUXF\tLuxembourg Franc to United Kingdom Sterling (WMR)\nMACAOPA\tMacao Pataca to United Kingdom Sterling (WMR)\nMACEDEN\tMacedonian Denar to United Kingdom Sterling (WMR)\nMADAGSF\tMalagasy Ariary to United Kingdom Sterling (WMR)\nMALAKWA\tMalawian Kwacha to United Kingdom Sterling (WMR)\nMALDRYA\tMaldive IS Rufiyaa to United Kingdom Sterling (WMR)\nMALTES£\tMaltese Lira to United Kingdom Sterling (WMR)\nMAURTAN\tMauritanian Ouguyia to United Kingdom Sterling (WMR)\nMAURRUP\tMauritius Rupee to United Kingdom Sterling (WMR)\nMOLDLEU\tMoldovan Leu to United Kingdom Sterling (WMR)\nMONGOTK\tMongolian Tugrik to United Kingdom Sterling (WMR)\nMOZAMBQ\tNew Mozambiq Metical to United Kingdom Sterling (WMR)\nNAMIBIA\tNamibian$ to United Kingdom Sterling (WMR)\nNEPALRP\tNepalese Rupee to United Kingdom Sterling (WMR)\nNANTGLD\tNetherlands Antilles to United Kingdom Sterling (WMR)\nGUILDER\tNetherlands Guilder to United Kingdom Sterling (WMR)\nPAPUAKN\tNew Guinea Kina to United Kingdom Sterling (WMR)\nNICARAG\tNicaraguan Cordoba to United Kingdom Sterling (WMR)\n'+
           'OMANRIA\tOman Rial to United Kingdom Sterling (WMR)\nPAKRUPE\tPakistan Rupee to United Kingdom Sterling (WMR)\nPANAMAB\tPanama Balboa to United Kingdom Sterling (WMR)\nPARAGAY\tParaguay Guarani to United Kingdom Sterling (WMR)\nPORTESC\tPortuguese Escudo to United Kingdom Sterling (WMR)\nQATARIA\tQatari Rial to United Kingdom Sterling (WMR)\nRWANDAF\tRwanda Franc to United Kingdom Sterling (WMR)\nSAUDRIY\tSaudi Riyal to United Kingdom Sterling (WMR)\nSERBDNA\tSerbian Dinar to United Kingdom Sterling (WMR)\nSEYCHEL\tSeychelle Rupee to United Kingdom Sterling (WMR)\nSIERLEO\tSierra Leone Leone to United Kingdom Sterling (WMR)\nSLOVKOR\tSlovak Koruna to United Kingdom Sterling (WMR)\nSLOVTOL\tSlovenian Tolar to United Kingdom Sterling (WMR)\nSOLOMON\tSolomon Islands$ to United Kingdom Sterling (WMR)\nSPANPES\tSpanish Peseta to United Kingdom Sterling (WMR)\nSTERSDR\tSDR to United Kingdom Sterling (WMR)\nSRIRUPE\tSri Lankan Rupee to United Kingdom Sterling (WMR)\nSURINGL\tSuriname Dollar to United Kingdom Sterling (WMR)\nSWAZILD\tSwaziland Lilangeni to United Kingdom Sterling (WMR)\n'+
           'TANSHIL\tTanzanian Shilling to United Kingdom Sterling (WMR)\nTHABAXT\tThai Baht Offshore to United Kingdom Sterling (WMR)\nTONGAPA\tTongan PA\'Anga to United Kingdom Sterling (WMR)\nTTOBDOL\tTrinidad and Tobago$ to United Kingdom Sterling (WMR)\nTUNISDN\tTunisian Dinar to United Kingdom Sterling (WMR)\nUAEDIRM\tUnited Arab Emirates Dirham to United Kingdom Sterling (WMR)\nUGANDAS\tUganda New Shilling to United Kingdom Sterling (WMR)\nUKRAINE\tUkraine Hryvnia to United Kingdom Sterling (WMR)\nURUGPES\tUruguayan Peso to United Kingdom Sterling (WMR)\nUZBESUM\tUzbekistan Sum Coup to United Kingdom Sterling (WMR)\nVANUATU\tVanuatu Vatu to United Kingdom Sterling (WMR)\nVENEBOL\tVenezuelan Bolivar F to United Kingdom Sterling (WMR)\nVIETNAM\tVietnamese Dong to United Kingdom Sterling (WMR)\nWESTSAM\tSamoan Tala to United Kingdom Sterling (WMR)\nYEMENRL\tYemen Rial to United Kingdom Sterling (WMR)\nZAMKWAC\tZambian Kwacha to GBP (WMR)\nZIMBDOL\tNew Zimbabwe$ to United Kingdom Sterling (WMR)\nZIMBZDN\tZimbabwe$ (Notional) to United Kingdom Sterling (WMR)\nNotes and what have you can go at the end.'
var attributes = [];


var UNDEFINED;

/*
function TextNode(text) { this.text = text; };
TextNode.prototype.length = function() { return this.text.length; };
TextNode.prototype.textContent = function() { return this.text; };
TextNode.prototype.toJSON = function() { return this.text; };
TextNode.prototype.attributes = function(index, attributes) { 
	return attributes || { start: [], end: [] }; 
};*/

//Treat elements as immutable so all methods can be memoized
function Element(klass, options) {
	options = options || {}
	this._space = options.space || ''; //space between children
	this.type = options.type || 'element';
	this._attribute = options.attribute || this.type;
	//this.children = [] //MUST BE IN SUBCLASS

	Element._constructors = Element._constructors || {}
	Element._constructors[this.type] = klass;
}

Element.prototype.length = function() {
	if (this._length === UNDEFINED) {
		//length of all the spaces
		var acc = this.children.length > 1 ? 
			(this.children.length - 1) * this._space.length :
			0;
		//+length of all the children
		for (var i = this.children.length - 1; i >= 0; i--) {
			var child = this.children[i]
			acc += (typeof child.length === 'number') ? child.length : child.length();
		};
		this._length = acc;
	}
	return this._length;
};
Element.prototype.textContent = function() {
	if (this._textContent === UNDEFINED) {
		this._textContent = this.children.map(function(c) {
			return (typeof c === 'string'? c : c.textContent());
		}).join(this._space);
	}
	return this._textContent;
}
Element.prototype.toJSON = function() {
	var ret = {};
	ret.type = this.type;
	for(var k in this) {
		if (this.hasOwnProperty(k) && !(/^_/.test(k)))
			ret[k] = this[k];
	}
	return ret;
};
Element.prototype.attributes = function(index, attributes) {
	index = index || 0;
	attributes = attributes || { start: [], end: [] };
	var starts = attributes.start;
	var ends = attributes.end;
	var endIndex = index + this.length();
	var start = starts[index] = starts[index] || {};
	var end = ends[endIndex] = ends[endIndex] || {};
	start[this._attribute] = { _type: this.type, _value: this.options };
	end[this._attribute] = true;
	var offset = index;
	var len = this.children.length;
	for (var i = 0; i < len; i++) {
		var child = this.children[i];
		//don't need to set attributes as it is modified in place
		if (typeof child === 'string') {
			offset += child.length + this._space.length;
		} else {
			child.attributes(offset, attributes);
			offset += child.length() + this._space.length;
		}
	};
	return attributes;
};

//first fragment in a document is main content.
function Document(fragments, options) { this.children = fragments || []; if (options) this.options = options }
function Fragment(sections, options) { this.children = sections || []; if (options) this.options = options }
function Section(paragraphs, options) { this.children = paragraphs || []; if (options) this.options = options }
function P(spans, options) { this.children = spans || []; if (options) this.options = options }
function Header(spans, options) { this.children = spans || []; if (options) this.options = options }
function Quote(spans, options) { this.children = spans || []; if (options) this.options = options }
function Ulli(spans, options) { this.children = spans || []; if (options) this.options = options }
function Olli(spans, opitons) { this.children = spans || []; if (options) this.options = options }
function Code(spans, options) { this.children = spans || []; if (options) this.options = options }
function Figure(spans, options) { this.children = spans || []; if (options) this.options = options }
function Table(rows, options) { this.children = rows || []; if (options) this.options = options }
function Row(cells, options) { this.children = cells || []; if (options) this.options = options }
function Cell(spans, options) { this.children = spans || []; if (options) this.options = options }
function Link(spans, options) { this.children = spans || []; if (options) this.options = options }
function Strong(spans) { this.children = spans || []; }
function Em(spans) { this.children = spans || []; }
function Sub(spans) { this.children = spans || []; }
function Sup(spans) { this.children = spans || []; }

function Result() {} //TODO: make a result object that takes up one character

Document.prototype = new Element(Document, {space: '\n', type: 'document'})
Fragment.prototype = new Element(Fragment, {space: '\n', type: 'fragment'});
Section.prototype = new Element(Section, {space: '\n', type: 'section'});
P.prototype = new Element(P, {type: 'p', attribute: 'paragraph'});
Header.prototype = new Element(Header, {type: 'header', attribute: 'paragraph'});
Quote.prototype = new Element(Quote, {type: 'quote',attribute: 'paragraph'});
Ulli.prototype = new Element(Ulli, {type: 'ulli', attribute: 'paragraph'});
Olli.prototype = new Element(Olli, {type: 'olli', attribute: 'paragraph'});
Figure.prototype = new Element(Figure, {type: 'figure', attribute: 'paragraph'});
Code.prototype = new Element(Code, {type: 'code', attribute: 'paragraph'});
Table.prototype = new Element(Table, {space: '\n', type: 'table', attribute: 'paragraph'});
Row.prototype = new Element(Row, {space: '\t', type: 'row'});
Cell.prototype = new Element(Cell, {type: 'cell'});
Link.prototype = new Element(Link, {type: 'link'});
Strong.prototype = new Element(Strong, {type: 'strong'});
Em.prototype = new Element(Em, {type: 'em'});
//TODO: if these are mutually exculsive then we should make them one class with an option
Sub.prototype = new Element(Sub, {type: 'sub'});
Sup.prototype = new Element(Sup, {type: 'sup'}); //we don't allow sup sup

function lvl(attrbutes) {
	var l = 0;
	for (var k in attrbutes) {
		if (ATTRIBUTES[k] && ATTRIBUTES[k] > l) l = ATTRIBUTES[k];
	}
	return l;
}

var ATTRIBUTES = {
	sup: 1,
	sub: 2,
	em: 3,
	strong: 4,
	link: 5,
	cell: 47,
	row: 48,
	paragraph: 50,
	section: 80,
	fragment: 90,
	document: 100,
};

var LEVELS = ATTRIBUTES;
//change attributes to ... {length: .., options: ...}

function wrap(cs, starts, ends, elvl, at) {
	var chunks = [];
	var klass;
	var emph = false;
	var last;
	var stack;
	var n;
	var end, start;
	cs.forEach(function(v, i) {
		start = starts[i] || {}
		end = ends[i] || {}
		if (start[at]) {
			if (emph) chunks[last] = new klass(stack, emph);
			emph = start[at];
			klass = Element._constructors[emph._type];
			emph = emph._value;
			stack = [];
			last = i;
		}
		if (end[at] && stack) {
			chunks[last] = new klass(stack, emph)
			emph = false;
			stack = null;
			last = i;
		}
		if (stack && last < i && 
			(lvl(start) > elvl || lvl(end) > elvl)) {
			chunks[last] = new klass(stack, emph);
			last = i;
			stack = [];
		}
		if (stack) {
			if (v !== null) stack.push(v)
		} else if (chunks[i] === undefined) {
			chunks[i] = v;
		}
	});
	if (stack) chunks[last] = new klass(stack, emph);
	return chunks;
}


//TODO: start offset for text...
function fromBase(str, start, end) { // -> document
	var points = [];
	start.forEach(function(v,i) { points[i] = true; });
	end.forEach(function(v,i) { points[i] = true; });
	points[str.length] = true;
	var last = 0;
	var chunks = [];
	var chunk;
	points.forEach(function(v, i) {
		if (i > last) {
			chunk = str.slice(last, i);
			if (chunk !== '\n' && chunk !== '\t')
				chunks[last] = chunk;
			else
				chunks[last] = null;
		}
		last = i;
	});
	for (var at in ATTRIBUTES) {
		var elvl = ATTRIBUTES[at];
		chunks = wrap(chunks, start, end, elvl, at);
	}
	return chunks;
}

//Very very slow version (all the way to text and back)
function insertText(doc, index, text) {
	//TODO: insert never needs to do anything with the att...
	// should just go to the bottom of the tree and zip back up.
	var str = doc.textContent();
	var att = doc.attributes();
	var start = [];
	var end = [];
	var len = text.length;
	str = str.slice(0, index) + text + str.slice(index);
	att.start.forEach(function(v, i) {
		if (i > index)
			start[i + len] = v;
		else
			start[i] = v;
	});
	att.end.forEach(function(v, i) {
		if (i >= index)
			end[i + len] = v;
		else
			end[i] = v;
	});
	var chunks = fromBase(str, start, end);
	return chunks[0];
}
//TODO: first remove the attributes then delete text
//if there are any between the delete text then it
//is an error.
function deleteText(doc, index, length) {
	var str = doc.textContent();
	var att = doc.attributes();
	var start = [];
	var end = [];
	var len = length;
	var endI = index + length;
	str = str.slice(0, index) + str.slice(index + length);
	var endCounts = {};
	att.end.forEach(function(v, i) {
		if (i <= index)
			end[i] = v;
		else if (i > endI)
			end[i - len] = v;
		else {
			end[index] = end[index] || {}
			for (var k in v) {
				endCounts[k] = (endCounts[k] || 0) + 1;
				end[index][k] = true;
			}
		}
	});
	att.start.forEach(function(v, i) {
		if (i <= index)
			start[i] = v;
		else if (i > endI)
			start[i - len] = v;
		else {
			start[index] = start[index] || {}
			for (var k in v) {
				if (endCounts[k] === UNDEFINED || (endCounts[k] -= 1) < 0)
					start[index][k] = v[k];
			}
		}
	});
	var chunks = fromBase(str, start, end);
	return chunks[0];
}
//DON'T LIKE THIS ATTRIBUTE CONCEPT... IT IS BROKEN BECAUSE IT DOESN'T STOP
//  B ... B .. E .... E (except it would probably cause an error)

//endIndex can come before start index
function setAttribute(doc, startIndex, endIndex, attribute, value) {
	var str = doc.textContent();
	var att = doc.attributes();
	var start = att.start;
	var end = att.end;
	start[startIndex] = start[startIndex] || {};
	end[endIndex] = end[endIndex] || {};
	if (!!start[startIndex][attribute] !== !!end[endIndex][attribute])
		throw "Will result in missmatched endpoints";
	if (!value._type) value = {_type: attribute, value: value};
	start[startIndex][attribute] = value;
	end[endIndex][attribute] = true;
	var chunks = fromBase(str, start, end);
	return chunks[0];
}
//just set with undefined
function removeAttribute(doc, startIndex, endIndex, attribute) {
	var str = doc.textContent();
	var att = doc.attributes();
	var start = att.start;
	var end = att.end;
	if (!(start[startIndex] || {})[attribute] || !(end[endIndex] ||{})[attribute])
		throw "Missing attribute";
	delete start[startIndex][attribute];
	delete end[endIndex][attribute];
	var chunks = fromBase(str, start, end);
	return chunks[0];
}

//Example
var a = new Document([
	new Fragment([new Section([
		new P(["This is a test"]),
		new P(),
		new P(["This is another test"])
		])
	])
]);

var att = a.attributes();
var str = a.textContent();
var chunks = fromBase(str, att.start, att.end);

var b = insertText(a, 15, "This is a paragraph that goes in the middle")
var c = insertText(b, 10, "very very good ")
var d = setAttribute(c, 0, 10, 'strong', true)
var e = insertText(d, 10, "probably ")
JSON.stringify(deleteText(c,30,44))


//operation transform example
// [5,"this", -4] // skip 5, insert "this", delete -4

//IDEA
// [{document: {...}, fragment: {..}, section: {...}, paragraph: {...}},"TEXT",
//  {paragraph: false},"\n",{paragraph: {}}, {paragraph: false}, "\n", {paragraph: {}}, "Some more text", 
// {paragraph: false, document: false, section: false, fragment: false}]

// Cannot dissallow empty items (as you need to be able to hit bold and then type)
//

function Mark(attribute, value, type) {
	this.attribute = attribute;
	this.value = value;
	if (type) this.type = type;
}
Mark.prototype.invert = function() {
	return new Unmark(this.attribute, this.value, this.type);
};

function Unmark(attribute, value, type) {
	this.attribute = attribute;
	this.value = value;
	if (type) this.type = type;
}
Unmark.prototype.invert = function() {
	return new Mark(this.attribute, this.value, this.type);
};

function Insert(str) {
	this.string = str;
}
Insert.prototype.invert = function() {
	return new Skip(this.string);
};

function Skip(str) { //delete
	this.string = str;
}
Skip.prototype.invert = function() {
	return new Insert(this.string);
};

function Retain(n) {
	this.n = n;
}
Retain.prototype.invert = function() {
	return this;
};

function Operations(ops) {
	this.ops = ops || [];
}
Operations.prototype.apply = function(doc) {
	// body...
};
Operations.prototype.invert = function() {
	return new Operations(this.ops.map(function(op) { return op.invert(); }));
};





////

/*
function Strong(spans) { this.children = spans; }
function Em(spans) { this.children = spans; }
function P(spans, options) { 
	this.children = spans;
	if (options) this.options = options; 
}
*/

//var Constructors = {
//	em: Em,
//	strong: Strong,
//	p: P,
//};

var Constructors = Element._constructors;

function Mark(attribute, options, type) {
	this.attribute = attribute;
	this.options = options;
	this.klass = Constructors[type || attribute]
}
function EndMark(attribute) {
	this.attribute = attribute;
}
/*
function UnMark(attributem options, type) {
	this.attribute = attributes;
	this.options = options;
	this.type = type;
}
function UnEndMark(attribute) {
	this.attribute = attribute;
}*/
function Retain(n) {
	this.n = n;
}

var exA = [new Mark('paragraph',{}, 'p'), 
	new Mark('em', true), 
	"Some cool ", 
	new Mark('strong', true), 
	"Text", 
	new EndMark('em'), 
	" that needs emphasis", 
	new EndMark('strong'), 
	". Followed by text that is just text", 
	new EndMark('paragraph'),
];

var exB = [new Mark('paragraph',{}, 'p'), 
	new Mark('em', true), 
	"Some cool ", 
	new Mark('strong', true), 
	"Text", 
	new EndMark('strong'), 
	" that needs emphasis", 
	new EndMark('em'), 
	". Followed by text that is just text", 
	new EndMark('paragraph'),
];


function apply(doc, ops) {
	var chunks = [];
	var stack = [];
	var yard = [];
	var level = 10000; //sentinel level
	var tl, n, op, nl;

	for (var i = 0; i < ops.length; i++) {
		op = ops[i];
		if (op instanceof Mark) {
			nl = LEVELS[op.attribute];
			while (nl >= level) {
				tl = stack.pop();
				level = tl.level;
				n = new tl.op.klass(chunks, tl.op.options);
				chunks = tl.chunks;
				chunks.push(n);
				yard.push(tl);
			}
			stack.push({op: op, chunks: chunks, level: level});
			chunks = [];
			level = nl;
			while(tl = yard.pop()) {
				op = tl.op;
				stack.push({op: op, chunks: chunks, level: level});
				level = tl.level;
				chunks = [];
			}
		} else if (op instanceof EndMark) {
			tl = stack.pop();
			while(tl.op.attribute !== op.attribute) {
				n = new tl.op.klass(chunks, tl.op.options);
				chunks = tl.chunks;
				chunks.push(n);
				yard.push(tl);
				tl = stack.pop();
			};
			n = new tl.op.klass(chunks, tl.op.options);
			chunks = tl.chunks
			chunks.push(n);
			level = tl.level;
			while(tl = yard.pop()) {
				op = tl.op;
				stack.push({op: op, chunks: chunks, level: level});
				level = tl.level;
				chunks = [];
			}
		} else if (typeof op === 'string') {
			//insert text
			chunks.push(op);
		}
	}

	while (tl = stack.pop()) {
		n = new tl.op.klass(chunks, tl.op.options);
		chunks = tl.chunks
		chunks.push(n);
	}

	return chunks[0];
}

'\n' + 
JSON.stringify(apply(null, exA)) + '\n' + 
JSON.stringify(apply(null, exB)) + '\n';
