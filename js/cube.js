/**
 * cube - computable document format.
 * Copyright (c) 2014, Benjamin Norrington
 */

;(function(base){

function Model(cells, seed) {
	this.cells = cells || [];
	this.seed = seed || 0;

	if (cells && !seed) {
		var me = this;
		this.cells.forEach(function(cell, i) {
			cell.key = me.seed++;
		});
	}
}

//Usage: Model.fromObj(JSON.parse(str));
//TODO: convert children
Model.fromObj = function(raw) {
	var obj = new Model();
	for(var i in raw)
		obj[i] = raw[i];
	return obj;
};

Model.prototype.toRaw = function() {
	return this.cells.map(function(cell, i) { return cell.raw}).join('');
};

Model.prototype.clone = function() {
	return new Model(this.cells.slice(0), this.seed);
};

Model.prototype.insertCell = function(cell, index, mutate) {
	var me = mutate ? this : this.clone();
	cell.key = me.seed++;
	cell.initialise();
	me.cells.splice(index,0,cell);
	return me;
};

//update/replace
Model.prototype.updateCell = function(cell, index, mutate) {
	var me = mutate ? this : this.clone();
	cell.key = this.cells[index].key;
	cell.initialise(this.cells[index]);
	me.cells[index] = cell;
	return me;
};

Model.prototype.removeCell = function(index, mutate) {
	var me = mutate ? this : this.clone();
	me.cells.splice(index,1);
	return me;
};

Model.prototype.merge = function(cells) {
	var me = this;
	var i = 0;
	var cell;
	var mutate = false;
	while (i < cells.length) {
		cell = cells[i];
		if (me.cells[i] && me.cells[i].raw === cell.raw) {
			//skip over identical cells
			i++;
			continue;
		}
		//different
		if (me.cells.length > cells.length) {
			me = me.removeCell(i, mutate);
			mutate = true;
			continue; //don't inc i
		}
		if (me.cells.length < cells.length) {
			me = me.insertCell(cell, i, mutate);
			mutate = true;
		} else {
			me = me.updateCell(cell, i, mutate);
			mutate = true;
		}
		i++;
	}
	while (i < me.cells.length) {
		me = me.removeCell(i, mutate);
		mutate = true;
	}
	return me;
};

//Cell types

function Cell() {};
Cell.prototype.toJSON = function() {
	var ret = {};
	for(var k in this) {
		if (this.hasOwnProperty(k) && !(/^_/.test(k)))
			ret[k] = this[k];
	}
	ret.type = this.type;
	return ret;
}
Cell.prototype.initialise = function(old) {}; //override to do things like

function Header(raw) {
	this.raw = raw;
	this.level = /^#+/.exec(raw)[0].length;
	this.text = raw.slice(this.level);
}
Header.prototype = new Cell();
Header.prototype.type = 'header';

function P(raw) {
	this.raw = raw;
	this.spans = (raw.length > 0 && raw !== '\n' ? [{type: 'text', text: raw}] : []);
}
P.prototype = new Cell();
P.prototype.type = 'p';

function Figure(raw) {
	this.raw = raw;
	var sub = /^!\[([^\]]*)\]\(([^\)]*)\)(.*)/.exec(raw);
	this.alt = sub[1];
	this.src = sub[2];
	this.caption = sub[3];
}
Figure.prototype = new Cell();
Figure.prototype.type = 'figure';

function Code(raw) {
	this.raw = raw;
	this.lang = (/^ function +[$A-Za-z_][0-9A-Za-z_$]* *\(/.test(raw)) ? 'javascript' : 'cube';
	this.text = raw.slice(1).replace(/\n /g,'\n');
}
Code.prototype = new Cell();
Code.prototype.type = 'code';
Code.prototype.initialise = function(old) {
	//TODO: tokenise the code
	//      parse the code.
}

function Ulli(raw) {
	this.raw = raw;
	this.spans = [{type: 'text', text: raw.slice(1)}];
}
Ulli.prototype = new Cell();
Ulli.prototype.type = 'ulli';

function Olli(raw) {
	this.raw = raw;
	this.spans = [{type: 'text', text: raw.slice(1)}];
}
Olli.prototype = new Cell();
Olli.prototype.type = 'olli';


function Quote(raw) {
	this.raw = raw;
	this.spans = [{type: 'text', text: raw.slice(1)}];
}
Quote.prototype = new Cell();
Quote.prototype.type = 'quote';

function Break(raw) {
	this.raw = raw;
}
Break.prototype = new Cell();
Break.prototype.type = 'break';

function Row(raw) {
	this.raw = raw;
	this.values = raw.slice(1).split('|');
}
Row.prototype = new Cell();
Row.prototype.type = 'tr';

function Table(raw) {
	this.raw = raw;
	var t = raw[raw.length-1] = '\n' ? raw.slice(0,-1) : raw;
	this.rows = t.split('\n').map(function(row,i) { 
		if (row.length === 0) return [];
		return row.slice(1).split('|');
	});
}
Table.prototype = new Cell();
Table.prototype.type = 'table';

var _constructors = {
	'#': Header,
	p:   P,
	'!': Figure,
	' ': Code,
	'*': Ulli,
	'.': Olli,
	'>': Quote,
	'-': Break,
	'|': Table, //Row,
};

//parse flat text representation of model into
//an array of cells.
function parse(text) {
	var match;
	var textN = text;
	var paras = [];
	//       break|code                                |table                   |other
	var block = /-|(?: [^\n]*(?:\n }[^\n]*|\n  [^\n]*)*|\|(?:[^\n]|\n\||\n\n\|)*|[^\n]*)(?:\n|$)/g;

	while (block.lastIndex < text.length && (match = block.exec(textN))) {
		var l = match[0];
		var capm = /^[\#\! \*\.\>\-\|]/.exec(l);
		var cap = capm ? capm[0] : 'p';
		if (cap === '!' && !(/^!\[([^\]]*)\]\(([^\)]*)\)(.*)/.test(l))) cap = 'p';
		else if (cap === '-' && l.length > 1) cap = 'p';
		var type = _constructors[cap];
		paras.push(new type(l));
	}
	paras.push(new P(''));
	return paras;
}

function Cube() {
	this.models = {scratch: new Model()};
	this.base = 'scratch';
};

Cube.Model = Model;
Cube.parse = parse;

base.Cube = Cube;

}(this || (typeof window !== 'undefined' ? window : global)));