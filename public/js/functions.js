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
	if(list===undefined) return sum;
	list.forEach(function(v,i) {
		if (v !== undefined && !isNaN(v)) {
			sum += v; 
		}
	});		
	return sum;
}

function Max(list) {
	var max;
	list.forEach(function(v,i) { 
		if ((max === undefined || max < v) && !isNaN(v)){
			max = v; 	
		} 
	});
	return max;
}

function Min(list) {
	var min;
	list.forEach(function(v,i) { 
		if ((min === undefined || min > v) && !isNaN(v)){
			min = v; 	
		} 
	});
	return min;
}

function CountNumbers(list){
	var num = 0;
	list.forEach(function(v,i){
		if(!isNaN(v)){
			num++;
		}
	});
	return num;
}

function RemoveLast(list, num) {
	if(list !== undefined && list.length>0) {
		if(num === undefined) num = 1;
		return list.slice(0,(list.length-Math.abs(num)));
	}
	else {
		return undefined;
	}
}

function Count(list){
	var num = 0;
	if(list === undefined) return num;
	list.forEach(function(v,i){
		num++;
	});
	return num;
}

function first(func, list) {
	var ret;
	list.some(function(element) {
		if (func(element)) {
			ret = element;
			return true;
		}
		return false;
	});
	return ret;
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
	if (list === null || list === undefined) return list;
	list.some(function(v,i) { head = v; return true;});
	return head;
}

function Tail(list) {
	if(list !== undefined && list.length>0) {
		return list.slice(1);
	}
	else {
		return undefined;
	}
}

function Last(list) {
	var tmp = list.slice(0);	
	return Head(tmp.reverse());
}

function Round(list) {  
	if(Array.isArray(list)) {
        return list.map(Math.round);
    }
    return Math.round(list);       
}

function Average(list) {
	var count = 0;
	var sum = 0;
	list.forEach(function(v,i){
		if(!isNaN(v)){
			sum += v;
			count++;
		}	
	});	
	return sum / count;
}

function Help(functionName){	
	var path = functionName.split('.');	
	var ret = [];	
	for (var i = 0; i < path.length; i++) {			
		ret.push(Cube.Functions[path[i]].Description);	
	};	
	return ret.join('\n');
}

Stdev.Description = "Estimates standard deviation based on a sample\nSyntax: Stdev(x)\nParameters: x (A list of numbers)";
function Stdev(list) {  
    var avg = Average(list);
    var flist = filterListToNumbers(list); 
    var res = flist.reduce(function(a,v){
        return a + Math.pow(v-avg,2);
    },0);  
    var variance = res / (Count(flist) -1);
    return Math.sqrt(variance);        	
}


Stdevp.Description = "Calculates standard deviation based on the entire population\nSyntax: Stdevp(x)\nParameters: x (A list of numbers)";
function Stdevp(list) {  
    var avg = Average(list);  
    var flist = filterListToNumbers(list);  
    var res = flist.reduce(function(a,v){
        return a + Math.pow(v-avg,2);
    },0);  
    var variance = res / Count(flist);
    return Math.sqrt(variance);    
}

function listSquaredReduced(list) {
	return list.reduce(function(a,b) {
		return a + Math.pow(b,2);
	},0);
}   

function filterListToNumbers(list) {
	return list.filter(function(a) {
		return (!isNaN(a)); 
	});
}    

function correlation(list) {
    var avg = Average(list);  
    function listLessAverage(l,b) {
    	return l.map(function(a) {
        	return a-b;
        });
	}       
    return {
        Average: avg,
        LessAverage: listLessAverage(list,avg),   
        SumSquared: listSquaredReduced(listLessAverage(list,avg)),
    };
}

Correl.Description = "Returns the correlation coefficient of two lists of the same length\nSyntax: Correl(x,y)\nParameters:\n x (A list of numbers)\n y (A list of numbers)";
function Correl(listA, listB) {
    var a = correlation(listA);
    var b = correlation(listB);
    
    var sumTotal = 0;
    for (var i = 0; i < listA.length; i++) {
        sumTotal += (a.LessAverage[i] * b.LessAverage[i]);
    }; 
    
    return sumTotal / Math.sqrt(a.SumSquared * b.SumSquared);
}

function Covariance(listA, listB, sample) {
	var aBar = 0;
	var bBar = 0;
	var q = 0;
	var n = 0;
	listA.forEach(function(a, i) {
		var b = listB[i];
		if (b === undefined || a === undefined) return;
		n += 1;
		aBar += a;
		bBar += b;
	});
	aBar = aBar / n;
	bBar = bBar / n;
	listA.forEach(function(a, i) {
		var b = listB[i];
		if (b === undefined || a === undefined) return;
		q += (a - aBar)*(b - bBar);
	});
	return q / (n - sample);
}

function CovarianceS(listA, listB) {
	return Covariance(listA, listB, 1);
}

function CovarianceP(listA, listB) {
	return Covariance(listA, listB, 0);
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

function _csv(headers, rows) {
	function cell(h) {
		if(h===undefined) return '';
		var c = h.toString();
		if (/,/.test(c)) c = '"' + c + '"';
		return c;
	}
	var str = new String(headers.map(cell).join(',') + '\n' +
		   rows.map(function(row) { 
		   	  return row.map(cell).join(',') 
		   }).join('\n') + '\n');
	str.contentType = 'text/csv'
	return str;
}

function File(name, f, type, displayName) {
	var a = document.createElement('a');
	a.appendChild(document.createTextNode(displayName || name));
	a.href = '#';
	a.onclick = function() {
		saveAs(new Blob([f()], {type: type}), name);
		return false;
	};
	return a;
}

function BasicTable(headers, rows, highlight) {
	//var c = document.createElement.bind(document);
	var table = document.createElement('table')
	var head = document.createElement('thead');//table.createTHead()
	var body = document.createElement('tbody');
	table.appendChild(head);
	table.appendChild(body);//table.createTBody();
	table.className = 'pure-table pure-table-horizontal';
	if (highlight === undefined) highlight = 0;

	var dataName = "";
	var hr = head.insertRow();
	headers.forEach(function(h, i) {
		var th = document.createElement('th');
		hr.appendChild(th);
		if (i < highlight) {
			th.className = 'highlight';
		} else {
			if(dataName!="") dataName = dataName.concat('_');
			dataName = dataName.concat(h.toString());
		}
		if (isElement(h)) {
			th.appendChild(h);
		} else {
			th.appendChild(document.createTextNode(h.toString()));
		}
	});

	var downloadLink = File('Qube.csv',function(){return _csv(headers, rows)}, 'text/csv',' ');
	var span = document.createElement('span');
	span.className = 'icon-download-alt';
	downloadLink.appendChild(span);

	//Add the link to the far right header
	hr.childNodes[headers.length-1].appendChild(downloadLink);

	var maxrows = 1000;

	if (rows.length > maxrows) {
		var foot = document.createElement('tfoot');
		table.appendChild(foot);
		var tr = foot.insertRow();
		var td = tr.insertCell(-1);
		td.colSpan = headers.length;
		td.className = 'info'
		td.appendChild(document.createTextNode(".... " + (rows.length - maxrows).toString() + " more rows."));
		rows = rows.slice(0,maxrows);
	}

	rows.forEach(function(r, j) {
		var tr = body.insertRow();
		r.forEach(function(e, i) {
			var th = tr.insertCell(-1);
			if (i < highlight) th.className = 'highlight';
			if (isElement(e)) {
				th.appendChild(e);
			} else {
				th.appendChild(document.createTextNode(e === undefined ? 'NULL' : e.toString()));
				if (e === true) {
					th.className = 'success';
				} else if (e === false) {
					th.className = 'error';
				}
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

function TypeOf(x) {
	return typeof(x);
}


function queryString(data) {
	var query = [];
    for (var key in data) {
        query.push(encodeURIComponent(key) + '=' + encodeURIComponent(data[key]));
    }
    return query.join('&');
}

FETCHING = {}; //sentinal
//gets data from jsonp call with caching in Cube
//note: refetch is cube.clearDataCache() then recalc.
function _data(cube, url, args, options) {
	var fullurl = url + '?' + queryString(args);
	var cache = cube.dataCache();
	var data = cache[fullurl];
	if (data === undefined) {
		cache[fullurl] = FETCHING;
		//make async call here for data
		JSONp.get(url, args, {
			onSuccess: function(data) {
				try {
					cache[fullurl] = JSON.parse(data);
				} catch (e) {
					cache[fullurl] = new Error(e.message);
				}
				cube.recalculate();

			},
			onTimeout: function() {
				cache[fullurl] = new Error("Timeout while fetching data");
				cube.recalculate();
			},
			timeout: options.timeout || 10,
		})
	}
	if (data === FETCHING) throw "Data pending...";
	if (data instanceof Error) throw data;
	return data;
}

function dot(key, obj) {
	if (arguments.length === 1)
		return dot.bind(null, key);
	if (obj === null || obj === undefined) return obj;
	return obj[key];
}

function index2(items, keys) {
	if (keys === null || keys === undefined || !(keys.length > 0)) return items;
	var cache = {};
	var rest = keys.slice(0);
	var key = rest.pop();
	//collect as list the items by last key
	items.forEach(function(item) {
		var k = item[key];
		if (cache.hasOwnProperty(k)) {
			cache[k].push(item);
		} else {
			cache[k] = [item];
		}
		
	});

	for (var k in cache) {
		cache[k] = index2(cache[k], rest);
	}
	return cache;
}

function index3(items, keys) {
	var rkeys = {};
	var values = {};
	if (items === undefined) return undefined;
	var ilen = items.length;
	var klen = keys.length;
	var elem;
	var key;
	var i, j;
	var keyVal;
	var current;
	var ret = {values: values, keys: {}};

	for (j = 0; j < klen; j++) {
		key = keys[j];
		rkeys[key] = {};	
	};

	for (i = 0; i < ilen; i++) {
		elem = items[i];
		current = values;
		for (j = klen -1; j >=0 ; j--) {
			key = keys[j];
			keyVal = elem[key];
			rkeys[key][keyVal] = true; //keep keys
			if (current.hasOwnProperty(keyVal)) {
				current = current[keyVal]
			} else {
				current = current[keyVal] = (j === 0 ? [] : {});
			}
		}
		current.push(elem);
	};

	for (var k in rkeys) {
		var kl = ret.keys[k] = [];
		for (var kv in rkeys[k]) {
			kl.push(kv);
		}
	}

	return ret;

}

function map(func, list) {
	if (list === null || list === undefined) return list;
	return list.map(func);
}

//list of list to list
function concat(list) {
	return Array.prototype.concat.apply([], list)
}

//list of list to list
function uconcat(list) {
	return Unique(Array.prototype.concat.apply([], list));
}

function toDateString(elem) {
	var ret;
	ret = Date.parse(elem);
	return ret.toDateString();
}

function format(list) {  
	if(Array.isArray(list)) {
        return list.map(function(item){
        	return item.toLocaleString();
        });
    }
    return list.toLocaleString();      
}

function coalesce(list){
	if(Array.isArray(list)){
		var ret = [];
		list.forEach(function(item){
			if(!(item === null || item === undefined)) ret.push(item);
		});
		return ret;
	}		
	return list;	
}

function numbers(list){
	if(Array.isArray(list)){
		var ret = [];
		list.forEach(function(item){
			if(!(item === null || item === undefined || isNaN(item))) ret.push(item);
		});
		return ret;
	}		
	return list;	
}

function isnull(x, val){
	if(!(x === null || x === undefined)) return x;	
	return val;	
}

//
mixin(Cube.Functions, {
	Sum: Sum,
	Max: Max,
	Min: Min,
	Average: Average,
	range: range,
	Head: Head,
	Tail: Tail,
	Last: Last,
	End: Last,
	Unique: Unique,
	_Table: _Table,
	BasicTable: BasicTable,
	Values: Values,
	Round:Round,
	Stdev:Stdev,
	Stdevp:Stdevp,
	Count:Count,
	CountNumbers:CountNumbers,
	Help:Help,
	Correl:Correl,
	CovarianceS: CovarianceS,
	CovarianceP: CovarianceP,
	"typeof": TypeOf,
	dot: dot,
	map: map,
	_data: _data,
	_csv: _csv,
	RemoveLast: RemoveLast,
	first: first,
	concat: concat,
	index: index3,
	indexb: index2,
	file: File,
	uconcat: uconcat,
	format: format,
	coalesce: coalesce,
	isnull:isnull,
	toDateString:toDateString,
	numbers:numbers,
});

}(this || (typeof window !== 'undefined' ? window : global)));