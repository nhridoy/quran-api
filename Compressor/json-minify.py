# 1st Method: Minify JSON
# import re
# import os
# import json
# filename = 'v2/quran.json'  # file name we want to compress
# newname = filename.replace('.json', '.min.json')  # Output file name
# fp = open(filename, encoding="utf8")
# print("Compressing file: " + filename)
# print('Compressing...')

# jload = json.load(fp)
# newfile = json.dumps(jload, indent=None, separators=(',', ':'))
# newfile = str.encode(newfile).decode('unicode_escape')
# f = open(newname, 'wb')
# f.write(newfile.encode('utf-8'))
# f.close()
# print('Compression complete! Type quit to exit IPython')

# 2nd Method: Minify JSON
# import json
# filename = 'quran.json'  # file name we want to compress
# newname = filename.replace('.json', '.min.json')  # Output file name
# read_file = open(filename, encoding="utf8")
# print("Compressing file: " + filename)
# print('Compressing...')
# data = json.load(read_file)
# # read_file.close()
# write_file = open(newname, 'wb')
# newfile = json.dumps(data, indent=None, separators=(',', ':'))
# newfile = str.encode(newfile).decode('unicode_escape')
# write_file.write(newfile.encode('utf-8'))
# write_file.close()
# print('Done!')
# print('Compressed file name:', newname)
# print('Original file size:', len(open(filename, 'r', encoding="utf8").read()))
# print('Compressed file size:', len(open(newname, 'r', encoding="utf8").read()))
# print('Compression ratio:', len(open(newname, 'r', encoding="utf8").read()
#                                 )/len(open(filename, 'r', encoding="utf8").read()))


# import re
# import os
# # cwd = os.getcwd()  # Get the current working directory (cwd)
# # files = os.listdir(cwd)  # Get all the files in that directory
# # print("Files in %r: %s" % (cwd, files))

# This is a python program to minify a large json file
# The file contains arabic caracters and it is very large
# After minification we need to keep the arabic character

# 3rd Method: Minify JSON

import json
import os


def minify(filename):
    newname = filename.replace('.json', '.min.json')  # Output file name
    read_file = open(filename, encoding="utf8")
    print("Compressing file: " + filename)
    print('Compressing...')
    data = json.load(read_file)
    new_file_location = os.path.join('./compressed/', newname)
    write_file = open(new_file_location, 'wb')
    newfile = json.dumps(data, indent=None, separators=(',', ':'))
    newfile = str.encode(newfile).decode('unicode_escape')
    write_file.write(newfile.encode('utf-8'))
    write_file.close()
    print('Done!')
    print('Compressed file name:', newname)
    print('Original file size:', len(
        open(filename, 'r', encoding="utf8").read()))
    print('Compressed file size:', len(
        open(new_file_location, 'r', encoding="utf8").read()))
    print('Compression ratio:', len(open(new_file_location, 'r', encoding="utf8").read()
                                    )/len(open(filename, 'r', encoding="utf8").read()))


def main():
    cwd = os.getcwd()  # Get the current working directory (cwd)
    files = os.listdir(cwd)  # Get all the files in that directory
    print("Files in %r: %s" % (cwd, files))
    for f in files:
        if f.endswith('.json'):
            minify(f)


if __name__ == '__main__':
    main()
