/**
 * cube - computable document format.
 * Copyright (c) 2014, Benjamin Norrington
 */

//requires window.Cube
;(function(base){

var Cube = base.Cube;
var showM = Cube.showM;
var showMr = Cube.showMr;
var showS = Cube.showS;
var expandMacros = Cube._expandMacros;

function mixin(obj, mix) {
	for (var k in mix) {
		obj[k] = mix[k];
	}
}

//Macros

function makeRecursion(func) {
	return function(expr) {
		var head = expr[0];
		if (head == 'Symbol') {
			return ['Let', ['Index', expr], func(expr)];
		}
		if (head == 'Subtract' || head == 'Plus') {
			var lhs = expr[1], rhs = expr[2];
			if (lhs[0] == 'Symbol' && rhs[0] == 'Number') {
				return ['Let', ['Index', lhs], [head, func(lhs), rhs]];
			}
		}
	};
}

function cond(bool, yes, no) { //actually "IF" but I cannot name it that.
	return ['Cond', bool, yes, no];
}


//This should only be called at the base level
// as Flip(X, Line, {Net Income, etc})
// or X = Flip(Line, {Net Income, etc})
function flip(symb, catSymb, expr) {
	if (expr[0] !== 'List')
		return ['Error', 'Flip joins a list of expr', sexpr];
	var qexpr = ['List'];
	expr.slice(1).forEach(function(s) {
		qexpr.push(showM(s));
	});
	var cat = ['Category', catSymb, qexpr];
	var func = ['Set*', symb, ['Indexed*', expr, ['Index', catSymb]]]; //need Indexed* and Set* to not do memo
	return ['Do', cat, func]; //Do A B is same as A\nB
}

//Table({Table({Graph.Line(Net Income[Month])},{Assum})})
//Table({Graph.Line(Net Income[Month][Growth]*Year)})
//Table({Graph.Line(Net Income[Month][Growth])})
//Table({Graph.Line(Net Income[Month][Growth])},{Year})
//Y = Table({Graph.Line(Net Income[Month][Growth])})
function postTable(exprs, quoteds, dims) {
	return expandDims(['Symbol', 'BasicTable'], exprs, quoteds, dims);
}

function expandDims(symb, exprs, quoteds, dims) {
	//exprs and quoteds are both expected to be list literals

	// ***** TODO : don't bother with all this dimension stuff
	//    just call annotateDimentions on it during compile.
	if (dims === undefined) {
		dims = exprs.dimensions;
	} else {
		dims = dims.slice(1).map(function(d) { 
			return d.dimensions[0]; 
		});
	}

	var len = ['Number', dims.length];
	var heads = ['List'];
	heads.dimensions = [];
	var fexpr = ['List'];
	fexpr.dimensions = dims;
	var type = (dims.length > 0) ? 'Over' : 'List';
	var over = [type, fexpr];
	over.dimensions = [];
	dims.forEach(function(d) { 
		var s = d.split('.'); 
		s.unshift('Symbol');
		s.dimensions = [d];
		fexpr.push(s); over.push(s); heads.push(['String', s[2]]); 
	});
	exprs.slice(1).forEach(function(d) { fexpr.push(d); });
	quoteds.slice(1).forEach(function(d) { heads.push(d); });
	return ['Call', symb, heads, over, len]; 
}

//pages should be of form {symb=value,...}
function pivot(expr, pages, rows, cols, descriptions) {
	return ['NoDim', ['PostMacro', ['Symbol', 'Pivot'], expr, 
		showM(expr), pages, cols, rows, descriptions]]; 
}

function postPivot(expr, quoted, pages, rows, cols, descriptions) {
	pages = pages || ['List'];
	descriptions = descriptions || ['List'];
	rows = rows || ['List'];
	cols = cols || ['List'];
	var descrips = {};

	descriptions.slice(1).forEach(function(desc, i) {
		//assume symbol with single dimension
		var dim = desc.dimensions[0];
		if (!descrips.hasOwnProperty(dim)) descrips[dim] = {syms:[], names:[]};
		descrips[dim].syms.push(desc);
		descrips[dim].names.push(showM(desc));
	});
	
	var page_titles = pages.map(function(s, i) {
		return (i === 0 ? 'List' : showM(s[1]));
	});
	var page_values = pages.map(function(s, i) {
		if (i === 0)
		  return 'List'
		var ret = ['Over', s[1], s[1]];
		ret.dimensions = [];
		return ret;
	});
	
	var page_selected = pages.map(function(s, i) {
		return (i === 0 ? 'List' : s[2]);
	});
	
	var data = expr;
	pages.slice(1).forEach(function(s) {
		data = ['LetS', ['Index', s[1]], ['IndexOf', s[1], s[2]], data];
	});
	
	
	var col_headers = ['List'];
	var col_dims = [];
	cols.slice(1).forEach(function(col, i) {
		var dim = col.dimensions[0];
		col_dims.push(dim);
		col_headers.push(col);
		if (descrips[dim]) {
			Array.prototype.push.apply(col_headers, descrips[dim].syms);
		}
	});
	
	var row_titles = ['List'];
	var row_headers = ['List'];
	var row_dims = [];
	rows.slice(1).forEach(function(row, i) {
		var dim = row.dimensions[0];
		row_dims.push(dim);
		row_headers.push(row);
		row_titles.push(showM(row));
		if (descrips[dim]) {
			Array.prototype.push.apply(row_titles, descrips[dim].names);
			Array.prototype.push.apply(row_headers, descrips[dim].syms);
		}
	});
	
	col_headers.dimensions = col_dims;
	var cx = cols.slice(1);
	cx.reverse();
	col_headers = ['Over', col_headers].concat(cx);
	col_headers.dimensions = [];
	
	
	row_headers.dimensions = row_dims;
	var rx = rows.slice(1);
	rx.reverse()
	row_headers = ['Over', row_headers].concat(rx);
	row_headers.dimensions = [];
	row_titles.dimensions = [];
	
	data.dimensions = row_dims.concat(col_dims);
	data = ['Over', data].concat(cols.slice(1));
	data.dimensions = row_dims;
	data = ['Over', data].concat(rows.slice(1));
	data.dimensions = [];
	
		return ['Call', ['Symbol', '_Pivot'], quoted, 
			page_titles, page_values, page_selected,
			col_headers, 
			row_titles, row_headers, 
			data]; 
}

function quoteM(expr) {
	return showM(expr);
}

function expand(expr) {
	return expandMacros(expr);
}

function quoteS(expr) {
	return ['String', showS(expr)];
}

function nodim(expr) {
	return ['NoDim', expr];
}

function graphLine(expr, over, series) {
	if (series !== undefined) {
		//expr, over, series
	} else if (over !== undefined) {
		//{expr, expr2}, over
	} else {
		//expr[over][over]
		if (expr[0] == 'Slice' &&
			expr[1][0] == 'Slice' &&
			expr[2][0] == 'Symbol' &&
			expr[1][2][0] == 'Symbol') {
			var iexpr = expr[1][1];
			var xexpr = ['Over', expr[1][2], expr[1][2]];
			var sexpr = ['Over', expr[2], expr[2]];
			var eexpr = ['Over', ['Over', iexpr,  expr[1][2]], expr[2]];
			return ['Call', 
				['Symbol', 'Graph', 'LineB'], 
				showM(iexpr), eexpr, xexpr, sexpr];
		}
	}
	return ['Call', ['Symbol', 'Graph', 'Line'], showM(expr), expr]; 
}

function data(url, args) {
	return ['Call', ['Symbol', '_data'], ['Cube'], url, args];
}

//most macros are applied before 
var Macros = {
	PREV: makeRecursion(function(symb) { return ['Subtract', ['Index', symb], ['Number', 1]];}),
	NEXT: makeRecursion(function(symb) { return ['Plus', ['Index', symb], ['Number', 1]];}),
	THIS: makeRecursion(function(symb) { return ['Index', symb];}),
	FIRST: makeRecursion(function(symb) { return ['Number', 0];}),
	LAST: makeRecursion(function(symb) { return ['Subtract', ['Count', symb], ['Number', 1]];}),
	PIVOT: pivot,
	QUOTE: quoteM,
	QUOTES: quoteS,
	EXPAND: expand, //usage Expand(QuoteS(...))
	NODIM: nodim,
	FLIP: flip,
	'GRAPH.LINE': graphLine,
	DATA: data,
	IF: cond,
};

//macros applied after analyse dimensions
// cannot be used in definitions as they 
// change the dimensions
var PostMacros = {
	//TABLE: postTable,
	PIVOT: postPivot,
	EXPANDDIMS: expandDims,
};

mixin(Cube.Macros, Macros);
mixin(Cube.PostMacros, PostMacros);

}(this || (typeof window !== 'undefined' ? window : global)));