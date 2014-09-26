# ContentEditable

“input” event fires on Chrome and Safari on Mac, but not IE9 on Windows 7 or IE11 on Windows Server 2012 R2


# Compile rules

    ["A", ["B", A_Number]] -> ["B", ["Times", A_, ["Number", 10]]]

    function(expr) {
    	if (expr[0] === "A") {
    		if (expr[1][0] === "B") {
    			if (expr[1][1][0] === "Number") {
    				var A_ = expr[1][1];
    				return ["B", ["Times", A_, ["Number", 10]]];
    			}
    		}
    	}
    	return expr;
    }
