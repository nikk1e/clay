/**
 * cube - computable document format.
 * Copyright (c) 2014, Benjamin Norrington
 */

//requires window.Cube
;(function(base){

var Cube = base.Cube;

function mixin(obj, mix) {
	for (var k in mix) {
		obj[k] = mix[k];
	}
}

//Functions for Cube

function Sum(list) {
	var sum = 0;
	list.forEach(function(v,i) { if (v !== undefined) sum += v; });
	return sum;
}


function Max(list) {
	var max;
	list.forEach(function(v,i) { 
		if (max === undefined || max < v) max = v; 
	});
	return max;
}

function range(start, end, step) {
	if (end === undefined) {
		end = start;
		start = 0;
	}
	if (step === undefined) step = 1;
	if (step <= 0) return [];

	var ret = [], cur = start;
	while (cur < end) {
		ret.push(cur);
		cur = cur + step;
	}
	return ret;
}

function Head(list) {
	var head;
	list.some(function(v,i) { head = v; return true;});
	return head;
}

function Unique(list) {
	var included = {}, ret = [];
	list.forEach(function(v, i) {
		if (!included.hasOwnProperty(v)) {
			ret.push(v);
			included[v] = true;
		}
	});
	return ret;
}

function _Table(list, ast) {
	//TODO: use the ast to figure out the table.
	return clay.code.show(ast);
}

function BasicTable(headers, rows, highlight) {
	var c = document.createElement.bind(document);
	var table = c('table'), head = table.createTHead(), body = table.createTBody();
	table.className = 'pure-table pure-table-horizontal';
	if (highlight === undefined) highlight = 0;

	var hr = head.insertRow();

	headers.forEach(function(h, i) {
		var th = c('th');
		hr.appendChild(th);
		if (i < highlight) th.className = 'highlight';
		if (isElement(h)) {
			th.appendChild(h);
		} else {
			th.appendChild(document.createTextNode(h.toString()));
		}
	});

	rows.forEach(function(r, j) {
		var tr = body.insertRow();
		r.forEach(function(e, i) {
			var th = tr.insertCell(-1);
			if (i < highlight) th.className = 'highlight';
			if (isElement(e)) {
				th.appendChild(e);
			} else {
				th.appendChild(document.createTextNode(e === undefined ? 'NULL' : e.toString()));
			}
		});
	});

	return table;
}

//Table({Math.round(Net Income), Tax, Revenue})
// returns only defined values
function Values(list) {
	return list.filter(function() { return true; });
}

//
mixin(Cube.Functions, {
	Sum: Sum,
	Max: Max,
	range: range,
	Head: Head,
	Unique: Unique,
	_Table: _Table,
	BasicTable: BasicTable,
	Values: Values,
});

}(this || (typeof window !== 'undefined' ? window : global)));