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

function Count(list){
	var num = 0;
	list.forEach(function(v,i){
		num++;
	});
	return num;
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
	if(Array.isArray(lst)) {
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
});

}(this || (typeof window !== 'undefined' ? window : global)));