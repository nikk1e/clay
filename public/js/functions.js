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

function FlattenArrays(){
	//arrayify all elements
	var clist = [].slice.apply(arguments).map(function(item){
		return Array.isArray(item) ? item : [item];
	});

	//create single array list from list of arrays
	return [].concat.apply([], clist);	
}

//Functions for Cube
Sum.Description = "Sums across a given list of numbers\nSyntax: sum(x)\nParameters: x (A list of numbers)";
function Sum() {
	var sum = 0;
	var list = FlattenArrays.apply(this, arguments);	
	list.forEach(function(v,i) {
		if (v !== undefined && !isNaN(v)) {
			sum += v; 
		}
	});		
	return sum;
}

Max.Description = "Returns the largest number from a given list\nSyntax: max(x)\nParameters: x (A list of numbers)";
function Max() {
	var max;
	var list = FlattenArrays.apply(this, arguments);
	list.forEach(function(v,i) { 
		if ((max === undefined || max < v) && !isNaN(v)){
			max = v; 	
		} 
	});
	return max;
}

Min.Description = "Returns the smallest number from a given list\nSyntax: min(x)\nParameters: x (A list of numbers)";
function Min() {
	var min;	
	var list = FlattenArrays.apply(this, arguments);
	list.forEach(function(v,i) { 
		if ((min === undefined || min > v) && !isNaN(v)){
			min = v; 	
		} 
	});
	return min;
}

CountNumbers.Description = "Counts only the numbers in a given list\nSyntax: countNumbers(x)\nParameters: x (A list of numbers)";
function CountNumbers(){
	var num = 0;
	var list = FlattenArrays.apply(this, arguments);
	list.forEach(function(v,i){
		if(!isNaN(v)){
			num++;
		}
	});
	return num;
}

RemoveLast.Description = "Removes the last n items from the list\nSyntax: removeLast(x, n)\nParameters: x (A list of numbers)\n           : n (An integer) - Optional, default (1)";
function RemoveLast(list, num) {
	if(list !== undefined && list.length>0) {
		if(num === undefined) num = 1;
		return list.slice(0,(list.length-Math.abs(num)));
	}
	else {
		return undefined;
	}
}

Count.Description = "Counts the elements in a given list\nSyntax: count(x)\nParameters: x (A list of numbers)";
function Count(list){
	var num = 0;
	if(list === undefined) return num;
	list.forEach(function(v,i){
		num++;
	});
	return num;
}

First.Description = "Returns the first element in a list which satisfies the function condition\nSyntax: first(f, x)\nParameters: f (A function which takes a single element and returns a boolean)\n          : x (A list of numbers)";
function First(func, list) {
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

Range.Description = "Returns a list of numbers which match the given range params\nSyntax: range(s, e, n)\nParameters: s (A number which defines where to start *included)\n          : e (A number which defines where to end *excluded)\n          : step (A number defining the step) - Optional, default (1)";
function Range(start, end, step) {
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

function ElementAt(list, pos){
	var ret = [];
	list.forEach(function(elem){
		ret.push(elem[pos]);
	});
	return ret;
}

Head.Description = "Returns the first element in the list\nSyntax: head(x)\nParameters: x (A list)";
function Head(list) {
	var head;
	if (list === null || list === undefined) return list;
	list.some(function(v,i) { head = v; return true;});
	return head;
}

Tail.Description = "Returns the list excluding the head element\nSyntax: tail(x)\nParameters: x (A list)";
function Tail(list) {
	if(list !== undefined && list.length>0) {
		return list.slice(1);
	}
	else {
		return undefined;
	}
}

Last.Description = "Returns the last element in the list\nSyntax: last(x)\nParameters: x (A list)";
function Last(list) {
	var tmp = list.slice(0);	
	return Head(tmp.reverse());
}

Round.Description = "Returns the list of numbers rounded to specified number of decimal places\nSyntax: round(x, n)\nParameters: x (A list of numbers)\n          : n (The numer of decimal places) - Optional, default (1)";
function Round(list, dp) {
	if (dp === undefined) dp = 0;
	if(Array.isArray(list)) {
		var ret = [];
		list.map(function(e){
			ret.push(e.toFixed(dp));
		});
        return ret;
    }
    return list.toFixed(dp);
}

Average.Description = "Returns an average given the #of numeric elements in the list\nSyntax: average(x)\nParameters: x (A list)";
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

Help.Description = "Describes the function requested\nSyntax: help(fn)\nParameters: fn (Name of function)";
function Help(functionName){	
	var path = functionName.split('.');	
	var ret = [];	
	for (var i = 0; i < path.length; i++) {			
		ret.push(Cube.Functions[path[i]].Description);	
	};	
	return ret.join('\n');
}

Stdev.Description = "Estimates standard deviation based on a sample\nSyntax: stdev(x)\nParameters: x (A list of numbers)";
function Stdev(list) {  
    var avg = Average(list);
    var flist = filterListToNumbers(list); 
    var res = flist.reduce(function(a,v){
        return a + Math.pow(v-avg,2);
    },0);  
    var variance = res / (Count(flist) -1);
    return Math.sqrt(variance);        	
}

Stdevp.Description = "Calculates standard deviation based on the entire population\nSyntax: stdevp(x)\nParameters: x (A list of numbers)";
function Stdevp(list) {  
    var avg = Average(list);  
    var flist = filterListToNumbers(list);  
    var res = flist.reduce(function(a,v){
        return a + Math.pow(v-avg,2);
    },0);  
    var variance = res / Count(flist);
    return Math.sqrt(variance);    
}

function filterListToNumbers(list) {
	return list.filter(function(a) {
		return (!isNaN(a)); 
	});
}    

function _correlation(list) {
    var avg = Average(list);  

    var listLessAvg = function(){
    	return list.map(function(a) {
        	return a-avg;
        });
    }();

	var listSquaredReduced = function() {
		return listLessAvg.reduce(function(a,b) {
			return a + Math.pow(b,2);
		},0);
	}(); 

    return {
        Average: avg,
        LessAverage: listLessAvg,   
        SumSquared: listSquaredReduced,
    };
}

Correl.Description = "Returns the correlation coefficient of two lists of the same length\nSyntax: correl(x,y)\nParameters:\n x (A list of numbers)\n y (A list of numbers)";
function Correl(listA, listB) {
    var a = _correlation(listA);
    var b = _correlation(listB);
    
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

function _Csv(headers, rows) {
	function cell(h) {
		if(h===undefined||h=== null) return '';
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

function datenum(v, date1904) {
	if(date1904) v+=1462;
	var epoch = Date.parse(v);
	return (epoch - new Date(Date.UTC(1899, 11, 30))) / (24 * 60 * 60 * 1000);
}

function Boolean(val, fallback){
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

function _File(cube, name, f, type, displayName) {
	var a = document.createElement('a');
	a.appendChild(document.createTextNode(displayName || name));
	a.href = '#';

	a.onclick = function() {

		var data;		
		
		try {
			data = f();
		}
		catch(err) {
			cube.onAfterPending.push(function() {
				var data = f();
				saveAs(new Blob([data], {type: type}), name);
			});;
			return false;
		}

		saveAs(new Blob([data], {type: type}), name);
		return false;
	};
	return a;
}

function _BasicTable(headers, rows, highlight) {
	//var c = document.createElement.bind(document);
	var table = document.createElement('table')
	var head = document.createElement('thead');//table.createTHead()
	var body = document.createElement('tbody');	
	table.appendChild(head);
	table.appendChild(body);//table.createTBody();
	table.className = 'pure-table pure-table-horizontal';
	if (highlight === undefined) highlight = 0;

	var reg = /sort=([A-Z\W][^}]*)/i;
	var sorts = headers.reduce(function(sorts, e, i){
							   		var m = e.match(reg);
							   		if(m){ sorts.push(i); }
							   		return sorts;
							   	}, []);

	for (var i = sorts.length - 1; i >= 0; i--) {		
		rows = rows.sort(function(a,b){
			var aS = a[sorts[i]].Sort;
			var bS = b[sorts[i]].Sort;
		
			//Needed to ensure numbers/strings sorted together.  (NaN, NULL etc screw things up...)
			if(isFinite(aS) == isFinite(bS)){
				if(aS > bS) { return 1; } 
				if(aS < bS) { return -1; }
				return 0;
			}

			if(!isFinite(aS)) { return 1; }
			if(!isFinite(bS)) { return -1; }
			return 0;
		});
		//Remove the sort from the return data
		rows.forEach(function(r){ r.splice(sorts[i],1);});
		headers.splice(sorts[i],1);
	};	
	
	var hr = head.insertRow();
	headers.forEach(function(h, i) {
		var th = document.createElement('th');
		hr.appendChild(th);
		if (i < highlight) th.className = 'highlight';
		if (isElement(h)) {
			th.appendChild(h);
		} else {
			th.appendChild(document.createTextNode(h.toString()));
		}
	});
		
	var downloadLink = _File(undefined, 'Qube.csv',function(){return _Csv(headers, rows)}, 'text/csv',' ');
	downloadLink.className = "table-download-link";
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
		td.className = 'info';
		td.appendChild(document.createTextNode(".... " + (rows.length - maxrows).toString() + " more rows."));
		rows = rows.slice(0,maxrows);
	}

	rows.forEach(function(r, j) {
		//Check if an 'empty' row
		rowClass = function(){
			return r.slice(highlight).every(function(e) {
					var n = e || 0;
					var isNumber = IsNumberCheck(n.toString().replace(/,/g,''));
					var isNotEmpty = !(e === undefined || e === null || e === '');
					return ((isNumber || isNotEmpty) && (n===0||n==="0"));
			}) ? 'zeroContent hide' : '';
		}

		var tr = body.insertRow();
		tr.className = rowClass();
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

function _queryString(data) {
	var query = [];
    for (var key in data) {
        query.push(encodeURIComponent(key) + '=' + encodeURIComponent(data[key]));
    }
    return query.join('&');
}

//Def function to see if any data pending


FETCHING = {}; //sentinal
//gets data from jsonp call with caching in Cube
//note: refetch is cube.clearDataCache() then recalc.
function _Data(cube, url, args, options) {
	var fullurl = url + '?' + _queryString(args);
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
					//Nothing to parse as is already obj
					if(e.message == "Unexpected token o"){
						cache[fullurl] = data;
					} else {
						cache[fullurl] = new Error(e.message);
					}
				}
				cube.recalculate();

			},
			onError: function() {
				cache[fullurl] = new Error("Problem while fetching data from ("+ (options.name || url) + "). Check file is not open...");
				cube.recalculate();
			},
			onTimeout: function() {
				cache[fullurl] = new Error("Timeout while fetching data from ("+ (options.name || url) + ").");
				cube.recalculate();
			},
			timeout: options.timeout || 10,
		})
	}
	if (data === FETCHING) throw "Data pending from (" + (options.name || url) + ")";
	if (data instanceof Error) throw data;
	return data;
}

function Dot(key, obj) {
	if (arguments.length === 1)
		return Dot.bind(null, key);
	if (obj === null || obj === undefined) return obj;
	return obj[key];
}

function Index(items, keys) {
	var rkeys = {};
	var values = {};
	if (items === undefined || items.every(function(i){ return i === undefined })) return undefined;
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

function Map(func, list) {
	if (list === null || list === undefined) return list;	
	return (Array.isArray(list) ? list : [list]).map(func);	
}

//list of list to list
function Concat(list) {
	return Array.prototype.concat.apply([], list)
}

function IsMonthEnd(list){
	if(Array.isArray(list)) {
		return list.map(function(item){
        	var date = moment(new Date(item));
        	var me = moment(new Date(item)).endOf('month').format("YYYYMMDD");
        	return me == date.format("YYYYMMDD");
        });
	}
	var date = moment(new Date(list));
	var me = moment(new Date(list)).endOf('month').format("YYYYMMDD");
	return me == date.format("YYYYMMDD");
}

function FormatDate(list,format) {
	if(Array.isArray(list)) {
        return list.map(function(item){
        	return dateFormat(item,format);
        });
    }   
    if (list === null || list === undefined) return list;
    return dateFormat(list,format); 
}

function IsDate(item){
	var date = new Date(item);
	return isNaN(date) ? false : true;
}

function ToUTC(item){	
	var date = moment(item);
	return date.toISOString();
}

function AddPeriod(list, amount, period){
	if(Array.isArray(list)){
		return list.map(function(item){
			return moment(item).add(amount,period);
		});
	}

	return moment(list).add(amount,period);
}

function MonthEnd(list, businessDays){
	if (list === null || list === undefined) return list;	
	businessDays = String(businessDays || false).toLowerCase() == "true";

	function end(item) {
		var mEnd = moment(item).endOf('month');    	
    	if(businessDays) return businessDay(mEnd, 0);
    	return mEnd;
    }

	if(Array.isArray(list)) {
        return list.map(function(item){
        	return end(item);
        });
    }

    return end(list);
}

function businessDay(date, days) {    	
	switch(date.weekday()) {
		case 0: return (days > 0) ? date.add(1, 'days') : date.add(-2, 'days');
		case 6: return (days > 0) ? date.add(2, 'days') : date.add(-1, 'days');
		default:return date;
	}
} 

function AddDays(list,days,businessDays) {
	if (list === null || list === undefined) return list;	
	businessDays = String(businessDays || true).toLowerCase() == "true";

	if(Array.isArray(list)) {
        return list.map(function(item){
        	return setDays(item);
        });
    }

    function setDays(item) {
    	var date = moment(item).add(days, 'days');
    	if(businessDays) return businessDay(date, days);
    	return date;
    }

    return setDays(list);
}

function Format(list) {
	if(Array.isArray(list)) {
        return list.map(function(item){
        	return item.toLocaleString();
        });
    }
    return list.toLocaleString();
}

Array.prototype.diff = function(a) {
    return this.filter(function(i) {return a.indexOf(i) < 0;});
};

function Diff(list, other) {
	var first = Array.isArray(list) ? list : [list];
	var second = Array.isArray(other) ? other : [other];
	return first.diff(second);
}

function Property(obj) {	
	var props = [];
	for(var propertyName in obj) {
		props.push(propertyName);
	}
    return props;
}

function IsNotNullCheck(item){	return !(item === null || item === undefined || item === "" || item.length == 0); }
function IsNumberCheck(item){ return !isNaN(parseFloat(item)) && isFinite(item); }

function IfNull(x, val){ return IsNotNullCheck(x) ? x : val; }
function IfNaN(x, val){ return !IsNumberCheck(x) ? val : x; }
function IsNaN(x) { return !IsNumberCheck(x); }
function IsNull(x) { return !IsNotNullCheck(x); }

//Bound when setting in the mixin
function FilterFunc(list){
	if(Array.isArray(list)) return list.filter(this);
	return this(list) ? undefined : list;
}

function Returns(list){
	if(Array.isArray(list)){
		var ret = [];
		list.forEach(function(item,indx,ary){
			if(indx==0||item==0) return ret.push(0);
			return ret.push((item / ary[indx-1])-1);
		});
		return ret;
	}	
	return 0;
}

function Reverse(list) {	
	return list.reverse();
}

function ToFixed(list, digits) {
	if(Array.isArray(list)) {
        return list.map(function(item){
        	return item.toFixed(digits);
        });
    }
    return list.toFixed(digits);
}

function Join(list, elem){
	var ret = Array.isArray(list) ? list.slice(0) : [list];
	ret.push(elem);
	return Array.isArray(elem) ? Concat(ret) : ret;
}

function Link(url, name){
	var a = document.createElement('a');
	a.appendChild(document.createTextNode(name || url));
	a.href = url;	
	a.target="_blank";
	return a;
}

function ListFunctions(){
	var ret = [];
	for (var prop in Cube.Functions) {
    	if (Cube.Functions.hasOwnProperty(prop) && /^[a-z]\w*/g.test(prop)) {
    		ret.push([prop,Cube.Functions[prop].Description || "No description..."]);
    	}
	}
	var sorted = ret.sort(function(a,b){ 
		if(a[0] < b[0]) return -1;
		if(a[0] > b[0]) return 1;
		return 0;
	});

	var table = _BasicTable(['Name','Description'],sorted,1);
	return table;
}

function CreateObj(items, keys) {
	var ret = [];
	var kLen = keys.length;

	items.forEach(function(elem){

		if(elem.length != kLen)
			throw "Cannot create obj, Keys/Items differ in lenth..."

		var item = {};
		for (j = 0; j < kLen; j++) {
			item[keys[j]] = elem[j];
		}
		ret.push(item);
	});

	return ret;
}

function Elements(items, path){
	var picker = function(elem, address){		
		var prop = address.shift();

		if(Array.isArray(elem)){			
			return elem.map(function(item){
				return (address.length>0) ? picker(elem[prop],address) : item[prop];				
			});
		}

		return (address.length>0) ? picker(elem[prop],address) : elem[prop];
	};

	var ret = picker(items, path.split('.'));
	return ret;
}

function RegexMatch(items, regex){
	var rr = new RegExp(regex);	

	if(Array.isArray(items)){
		var ret = [];
		items.forEach(function(elem){
			ret.push(rr.exec(items) === null ? undefined : rr.exec(items));
		});

		return ret;
	}

	return rr.exec(items) === null ? undefined : rr.exec(items);
}

function Product(list){
	if(Array.isArray(list)){
		//Remove any which are not numbers
		var filteredList = list.filter(function(elem){
			return !IsNaN(elem);
		});

		if(filteredList.length > 0){
			return filteredList.reduce(function(prev,curr){
				return prev * curr;
			});
		}
	}	
	return list;
}

var funcList = {
	//Hidden
	_Table: _Table,
	_BasicTable: _BasicTable,
	_Data: _Data,	
	_Csv: _Csv,	
	//Aggregates
	sum: Sum,	
	max: Max,	
	min: Min,	
	avg: Average,
	count: Count,
	countNumbers: CountNumbers,
	returns:Returns,
	product:Product,
	//List manipulations
	range: Range,
	head: Head,
	tail: Tail,
	last: Last,
	first: First,
	concat: Concat,
	reverse: Reverse,
	join: Join,
	removeLast: RemoveLast,
	diff:Diff,	
	unique: Unique,	
	values: Values,
	elementAt: ElementAt,
	//Formats
	round: Round,
	toFixed: ToFixed,
	format: Format,
	formatDate: FormatDate,
	//Dates
	addDays: AddDays,
	addPeriod:AddPeriod,
	isMonthEnd: IsMonthEnd,
	monthEnd: MonthEnd,
	toUTC: ToUTC,
	//Maths
	stdev: Stdev,
	stdevp: Stdevp,
	correl: Correl,
	covarianceS: CovarianceS,
	covarianceP: CovarianceP,
	perf:Product,
	//Helpers
	help: Help,
	listFunctions:ListFunctions,
	property:Property,
	"typeof": TypeOf,
	dot: Dot,
	map: Map,
	index: Index,
	_File: _File,
	link: Link,
	//Checkers
	isNaN: IsNaN,
	isDate: IsDate,
	isNull: IsNull,
	ifNaN: IfNaN,
	ifNull: IfNull,
	coalesce: FilterFunc.bind(IsNotNullCheck),
	filterNulls: FilterFunc.bind(IsNotNullCheck),
	numbers: FilterFunc.bind(IsNumberCheck),
	filterNumbers: FilterFunc.bind(IsNumberCheck),
	createObj:CreateObj,
	regexMatch:RegexMatch,
	elements:Elements,
};

//
mixin(Cube.Functions, funcList);

}(this || (typeof window !== 'undefined' ? window : global)));
