import flask
from flask import Flask, Response, redirect, send_from_directory,\
     render_template, request
import threading
import os
import sys
import time
import socket

CurDir = __file__.replace("\\", "/").rsplit('/', 1)
if len(CurDir) != 2:
    CurDir = os.path.abspath(".").replace("\\", "/").rstrip("/")
else:
    CurDir = CurDir[0]

def GetTmFmt():
    Tm = time.localtime()
    Rtn = str(Tm.tm_year) + "-"
    Mon = str(Tm.tm_mon)
    Mon = "0" * (2 - len(Mon)) + Mon
    Day = str(Tm.tm_mday)
    Day = "0" * (2 - len(Day)) + Day
    Rtn += Mon + "-" + Day + " "
    Hour = str(Tm.tm_hour)
    Hour = "0" * (2 - len(Hour)) + Hour
    Min = str(Tm.tm_min)
    Min = "0" * (2 - len(Min)) + Min
    Sec = str(Tm.tm_sec)
    Sec = "0" * (2 - len(Sec)) + Sec
    Rtn += Hour + ":" + Min + ":" + Sec
    return Rtn

LOG_SEVERE = 0
LOG_ERROR = 1
LOG_WARNING = 2
LOG_INFO = 3
LOG_FINE = 4
LOG_FINER = 5
LOG_FINEST = 6
class Logger(object):
    Lvls = ["SEVERE", "ERROR", "WARNING", "INFO", "FINE", "FINER", "FINEST"]
    LogFmt = "%s [%s][%s] %s\n"
    def __init__(self, Module, LstFl, LstLvl, LogLk=None):
        """
        :type Module: basestring
        :type LstFl: list[T]
        :type LstLvl: list[int]
        :type LogLk: thread.LockType | _thread.LockType | None
        """
        self.LstFl = list(LstFl)
        self.LstLvl = list(LstLvl)
        self.Mod = Module
        self.LogLk = LogLk if LogLk is not None else threading.Lock()
    def Log(self, Str, Lvl=LOG_INFO):
        """
        :type Str: basestring
        :type Lvl: int
        """
        for FlLvl in self.LstLvl:
            if Lvl <= FlLvl: break
        else: return
        StrLog = self.LogFmt % (GetTmFmt(), Logger.Lvls[Lvl], self.Mod, Str)
        with self.LogLk:
            for c in xrange(len(self.LstFl)):
                if Lvl > self.LstLvl[c]: continue
                Fl = self.LstFl[c]
                Fl.write(StrLog)
                Fl.flush()
    __call__ = Log
    def MkSubLog(self, Module, LstLvl=None):
        """

        :type Module: basestring
        :type LstLvl: list[int]
        :return:
        """
        if LstLvl is None: LstLvl = self.LstLvl
        return Logger(Module, self.LstFl, LstLvl, self.LogLk)
Log = Logger("MAIN", [sys.stdout], [len(Logger.Lvls)])

app = Flask(__name__)
BinFmt = "application/octet-stream"
DctMIMETypes = {
    "js":"text/javascript", "css":"text/css", "htm":"text/html",
    "html":"text/html", "htmls":"text/html", "txt":"text/plain",
    "log":"text/plain", "png":"image/png", "gif":"image/gif",
    "jpeg":"image/jpeg", "jpg":"image/jpeg", "bmp":"image/bmp",
    "a":BinFmt, "bin":BinFmt, "gz":BinFmt, "7z":BinFmt, "lib":BinFmt,
    "dll":BinFmt, "so":BinFmt, "exe":BinFmt, "com":BinFmt, "bin":BinFmt,
    "jar":BinFmt, "rar":BinFmt, "zip":BinFmt, "tar":BinFmt, "iso":BinFmt,
    "mp4":"video/mp4", "mp3":"audio/mpeg", "pdf":"application/pdf"}
DctMIMEType_Routes = {}

@app.route("/")
def blank():
    return redirect("/index.html")
class StaticRoute(object):
    def __init__(self, GlobalRoute, fName, Name):
        self.fName = fName
        self.GlobalRoute = GlobalRoute
        self.__name__ = Name
        mimetype = DctMIMEType_Routes.get(GlobalRoute, None)
        if mimetype is None:
            EndComp = fName.rsplit('/', 1)[-1]
            EndComp = EndComp.rsplit('.', 1)
            if len(EndComp) >= 2:
                mimetype = DctMIMETypes.get(EndComp[-1], None)
        self.mimetype = mimetype
    def __call__(self):
        Log.Log("sending file: %s as %s" % (self.GlobalRoute, self.mimetype))
        return flask.send_file(
            self.fName, mimetype=self.mimetype, cache_timeout=0)
def GetStaticRoute((Name, fName), Dir="/static"):
    Dir = CurDir + Dir
    Path = Dir + fName
    if not os.path.isfile(Path):
        raise OSError("File not Found: %s" % Path)
    return StaticRoute(fName, Path, Name)
def GetRLE(BoardId):
    with open(CurDir + "/Board.txt", "r") as Fl:
        for c, line in enumerate(Fl, 1):
            line = line.strip()
            if len(line) == 0:
                continue
            KeyValue = map(lambda x: x.strip(), line.split(':', 1))
            if len(KeyValue) != 2 or not KeyValue[0].isdigit():
                Log.Log("Board.txt file invalid key: value syntax line %u"%c, 2)
                continue
            if int(KeyValue[0]) == BoardId:
                return KeyValue[1]
    return "2b9b8e7e4935b6c59f361d4b72d69b4d235f17c2b8214e9e9b1b8"
@app.route("/index.html")
def index():
    board = ["_"] * 81
    rle = request.args.get('rle', None)
    if rle is None:
        boardId = request.args.get('b_id', None)
        if boardId is not None:
            if boardId.isdigit():
                boardId = int(boardId)
            rle = GetRLE(boardId)
    StrBoard = "null"
    if rle is not None:
        c = 0
        ZeroCapture = False
        ZeroStr = ""
        for ch in rle:
            if ch.isdigit():
                if ZeroCapture:
                    ZeroStr += ch
                elif ch != '0':
                    board[c] = int(ch)
                    c += 1
                else:
                    ZeroCapture = True
            elif ch.isalpha():
                if ZeroCapture:
                    ZeroCapture = False
                    c += int(ZeroStr)
                c += ord(ch.upper()) - ord('A')
            else:
                continue
            if c > len(board):
                print "WARN: end of board c > len(board)"
                break
        DeFlatBoard = [
            [str(board[c + i]) for i in xrange(0, 9)]
            for c in xrange(0, 81, 9)]
        StrBoard = "[%s]" % ",".join(map(
            lambda line: "[%s]" % ", ".join(line),
            DeFlatBoard))
    return render_template("index.html", board=StrBoard)
LstStatMap = [
    ("app_css", "/app.css"),
    ("app_js", "/app.js"),
    ("png_undo", "/undo.png"),
    ("png_redo", "/redo.png")]
LstStaticRoutes = list(map(GetStaticRoute, LstStatMap))
for Route in LstStaticRoutes:
    Log.Log("Routing %s to %s" % (Route.GlobalRoute, Route.fName))
    app.route(Route.GlobalRoute)(Route)
hostname = socket.gethostname()
if os.name == "posix" and not hostname.endswith(".local"):
    hostname += ".local"

if __name__ == "__main__":
    if hostname == "DESKTOP-LKHVM9T":
        hostname = "localhost"
    app.run(host=hostname,port=5000)
