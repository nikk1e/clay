import json
import os
import sys

def make_listing(path):
	dirhash = {}
	out = []
	dirhash[path] = {'children':out}
	for root, dirs, files in os.walk(path):
		current = dirhash[root]
		children = current['children']
		for f in files:
			children.append({'type':'file', 'name':f})
		for d in dirs:
			t = dirhash[os.path.join(root,d)] = {'type':'directory', 'name':d, 'children':[]}
			children.append(t)
	return out


if __name__ == '__main__':
	import sys
	if (len(sys.argv) < 2):
		print >> sys.stderr, 'Usage:\n\npython _make_listing.py path > outfile.json'
		exit(1)
	print json.dumps(make_listing(sys.argv[1]))