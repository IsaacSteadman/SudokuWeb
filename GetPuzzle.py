import urllib2

def ProcAttrVal(Line, Start):
    End = len(Line)
    Ch = Line[Start]
    if Ch == '\'' or Ch == '\"':
        Start += 1
        End = Line.find(Ch, Start)
    else:
        for c in xrange(Start, End):
            if Line[c].isspace():
                End = c
                break
    if End == -1: End = len(Line)
    return Line[Start:End]

def GetLines():
    DctLines = {"cheat": None, "editmask": None}
    Fl = urllib2.urlopen("http://show.websudoku.com/?level=4")
    nLeft = len(DctLines)
    for Line in Fl:
        Line = Line.strip()
        Upper = Line.upper()
        if "INPUT" in Upper:
            Pos = Upper.find("ID=")
            if Pos == -1: continue
            Id = ProcAttrVal(Line, Pos + 3)
            if Id in DctLines:
                if DctLines[Id] is None:
                    nLeft -= 1
                DctLines[Id] = Line
                if nLeft == 0: break
    Fl.close()
    return DctLines
def ProcLines(DctLines):
    Rtn = {k: None for k in DctLines}
    for k in DctLines:
        Line = DctLines[k]
        Pos = Line.upper().find("VALUE=")
        if Pos == -1: continue
        Rtn[k] = ProcAttrVal(Line, Pos + 6)
    return Rtn
def ToRLE(DctVals):
    cheat = DctVals["cheat"]
    editmask = DctVals["editmask"]
    assert len(cheat) == len(editmask)
    Rtn = ""
    CurRun = 0
    a = ord('a')
    for c in xrange(len(cheat)):
        if editmask[c] == '0':
            val = ord(cheat[c]) - ord('0')
            assert 1 <= val <= 9, "invalid sudoku number (1 <= x <= 9)"
            if CurRun > 25:
                Rtn += "0%ua" % CurRun
            elif CurRun:
                Rtn += chr(a + CurRun)
            CurRun = 0
            Rtn += cheat[c]
        else: CurRun += 1
    return Rtn
def GetPuzzle():
    DctLines = GetLines()
    DctVals = ProcLines(DctLines)
    rle = ToRLE(DctVals)
    return rle, DctVals["cheat"]
LstData = [None] * 100
cI = 202
for c in xrange(len(LstData)):
    LstData[c] = GetPuzzle()
    print "%u: %s" % (c + cI, LstData[c][0])
