'use strict';
class BoxView {
	constructor(board, x, y) {
		this.board = board;
		this.x = x;
		this.y = y;
		this.o_n = board.nCols; // same as board.n ** 2
    this.n = board.n;
    this.off_x = x * this.n
    this.off_y = y * this.n;
		// js specific
		this.length = this.o_n;
	}
	GetRowCol_i(i) {
		let y = Math.floor(i / this.n);
		let x = i % this.n;
    return this.GetRowCol_xy(x, y);
	}
  GetRowCol_xy(x, y) {
    let board_x = this.off_x + x;
    let board_y = this.off_y + y;
    return [board_x, board_y];
	}
	GetNote_i(i) {
		let tmp = this.GetRowCol_i(i);
    let board_x = tmp[0];
		let board_y = tmp[1];
    return this.board.notes[board_y * this.o_n + board_x];
	}
}
class Note {
  constructor(z) {
    this.z = z;
	}
  Set(n) {
    this.z |= 1 << n;
	}
  Clr(n) {
    let mask = 1 << n;
    this.z = (this.z | mask) ^ mask;
	}
  Get(n) {
    return ((this.z >> n) & 0x01) !== 0;
  }
	GetLst(LenLst) {
		let Rtn = [];
		Rtn.length = LenLst;
    let z1 = this.z;
    for (let c = 0; c < LenLst; ++c) {
      if (z1 & 0x01) Rtn[c] = c;
			else Rtn[c] = null;
      z1 >>= 1;
		}
    return Rtn.filter((x) => { return x != null; });
	}
}
function GetLstNoteInt(z, LenLst) {
	let Rtn = [];
	Rtn.length = LenLst;
	for (let c = 0; c < LenLst; ++c) {
		if (z & 0x01) Rtn[c] = c;
		else Rtn[c] = null;
		z >>= 1;
	}
	return Rtn.filter((x) => { return x != null; });
}
function NoteToText(note, n, nFind) {
	n = n || 3;
	let sz = n * n;
	if (sz !== 9) throw new Error("nRows = " + sz + " is unsupported at the moment (only 9)");
	let ArrRes = [];
	ArrRes.length = n;
	for (let c = 0; c < n; ++c) {
		ArrRes[c] = [];
		ArrRes[c].length = n;
		for (let c1 = 0; c1 < n; ++c1) {
			let i = c * n + c1;
			ArrRes[c][c1] = note.Get(i) ? (++nFind[i], "" + (i + 1)) : "\u2007";
		}
	}
	return ArrRes.map((arr) => { return arr.join("\u2007"); }).join("\n");
}
class SudokuBoard {
	constructor(Elem) {
		this.Dom = Elem;
		this.hl = null;
		this.LstTable = [];
		this.notes = [];
		this.data = [];
		this.LstCmdStackCb = [];
		var Rows = $(this.Dom).find("tbody>tr");
		this.n = 3;
		this.nRows = this.nCols = this.n * this.n;
		this.LstTable.length = Rows.length;
		this.notes.length = this.nCols * this.nCols;
		this.data.length = this.nCols * this.nCols;
		var c, c1;
		for (c = 0; c < Rows.length; ++c) {
			let Cols = $(Rows[c]).find(">td");
			if (Cols.length !== Rows.length) {
				throw new Error("Bad Row length: " + c);
			}
			this.LstTable[c] = [];
			this.LstTable[c].length = Cols.length;
			for (c1 = 0; c1 < Cols.length; ++c1) {
				this.LstTable[c][c1] = Cols[c1];
				let i = this.GetIndex(c1, c);
				this.notes[i] = new Note(0)
				this.data[i] = null;
				$(Cols[c1]).data({row: c, col: c1});
			}
		}
		this.CmdStack = [];
		this.CmdPos = 0;
		this.ClkHL = null;
	}
	HighLight (n) {
		this.hl = n;
		this.UpdateDOM();
	}
	UpdateDOM () {
		let nFind = [0,0,0,0,0,0,0,0,0];
		for (let c = 0; c < this.nRows; ++c) {
			let Lst1 = this.LstTable[c];
			for (let c1 = 0; c1 < this.nCols; ++c1) {
				let data = this.GetElem(c1, c);
				let $Cur = $(Lst1[c1]);
				$Cur.removeClass("hl");
				if (data != null) {
					Lst1[c1].innerText = "" + (data + 1);
					$Cur.addClass("big");
				} else {
					data = this.GetNote(c1, c);
					Lst1[c1].innerText = NoteToText(data, null, nFind);
					$Cur.removeClass("big");
					if (this.hl != null && data.Get(this.hl)) {
						$Cur.addClass("hl");
					}
				}
			}
		}
		if (this.ClkHL == null) return;
		for (let c = 0; c < nFind.length; ++c) {
			let v = nFind[c];
			let $Cur = $(this.ClkHL[c]);
			if (v === 0) {
				$Cur.addClass("hl_none");
				$Cur.removeClass("hl_one");
			} else if (v === 1) {
				$Cur.addClass("hl_one");
				$Cur.removeClass("hl_none");
			} else {
				$Cur.removeClass("hl_none");
				$Cur.removeClass("hl_one");
			}
		}
	}
	ExecuteCommand(Command) {
		Command.execute(this);
		this.CmdStack.splice(this.CmdPos, this.CmdStack.length, Command);
		this.CmdPos = this.CmdStack.length;
		this.ExecCmdHooks();
	}
	GetUndoLabel() {
		if (this.CmdPos <= 0) return null;
		return this.CmdStack[this.CmdPos - 1].GetLabel();
	}
	Undo() {
		if (this.CmdPos <= 0) return;
		this.CmdStack[--this.CmdPos].unexecute(this);
		this.ExecCmdHooks();
	}
	GetRedoLabel() {
		if (this.CmdPos >= this.CmdStack.length) return null;
		return this.CmdStack[this.CmdPos].GetLabel();
	}
	Redo() {
		if (this.CmdPos >= this.CmdStack.length) return;
		this.CmdStack[this.CmdPos++].execute(this);
		this.ExecCmdHooks();
	}
	AddCmdHook(fn) {
		this.LstCmdStackCb.push(fn);
	}
	RemCmdHook(fn) {
		var pos = this.LstCmdStackCb.indexOf(fn);
		if (pos === -1) return null;
		else {
			this.LstCmdStackCb.splice(pos, 1);
		}
		return fn;
	}
	ExecCmdHooks() {
		for (let c = 0; c < this.LstCmdStackCb.length; ++c) {
			this.LstCmdStackCb[c](this);
		}
	}
	GetIndex(x, y) {
		return y * this.nCols + x;
	}
	GetNote(x, y) {
		return this.notes[this.GetIndex(x, y)];
	}
	GetElem(x, y) {
		return this.data[this.GetIndex(x, y)];
	}
	SetElem(x, y, val) {
		this.data[this.GetIndex(x, y)] = val;
	}
	SetElemSmart(x, y, val) {
		let off_y = y * this.nCols;
    let i = off_y + x;
    this.data[i] = val;
    this.notes[i].z = 0;
    let box_x = Math.floor(x / this.n);
    let box_y = Math.floor(y / this.n);
    for (let c = off_y; c < off_y + this.nCols; ++c) {
      this.notes[c].Clr(val);
		}
    for (let c = x; c < this.data.length; c += this.nCols) {
      this.notes[c].Clr(val);
		}
    let box = this.GetBox_xy(box_x, box_y);
    for (let c = 0; c < box.length; ++c) {
      let note = box.GetNote_i(c);
    	note.Clr(val);
		}
	}
	GetBox_xy(x, y) {
    return new BoxView(this, x, y);
	}
	GetBox_i(i) {
		let y = Math.floor(i / this.n);
		let x = i % this.n;
    return new BoxView(this, x, y)
	}
    /*GetCol(x) {
        return new ColView(this, x);
	}
    GetRow(y) {
        return new RowView(this, y);
	}*/
}
class CommandEditSudoku {
	constructor(x, y, val) {
		this.x = x;
		this.y = y;
		this.val = val;
		this.NoteDiff = null;
		this.ValOrig = null;
	}
	GetLabel() {
		return "Set Box at x = " + (this.x + 1) + ", y = " + (this.y + 1) + " to " + (this.val + 1);
	}
	execute(board) {
		if (this.NoteDiff != null) {
			console.log("WARN: @execute(board): NoteDiff != null");
		}
		this.NoteDiff = [];
		this.NoteDiff.length = board.nRows;
		for (let c = 0; c < board.nRows; ++c) {
			let CurNotes = this.NoteDiff[c] = [];
			CurNotes.length = board.nCols;
			for (let c1 = 0; c1 < board.nCols; ++c1) {
				CurNotes[c1] = board.GetNote(c1, c).z;
			}
		}
		this.ValOrig = board.GetElem(this.x, this.y);
		board.SetElemSmart(this.x, this.y, this.val);
		board.UpdateDOM();
	}
	unexecute(board) {
		if (this.NoteDiff == null) {
			console.log("WARN: @unexecute(board): NoteDiff == null");
		}
		for (let c = 0; c < board.nRows; ++c) {
			let CurNotes = this.NoteDiff[c];
			for (let c1 = 0; c1 < board.nCols; ++c1) {
				board.GetNote(c1, c).z = CurNotes[c1];
			}
		}
		board.SetElem(this.x, this.y, this.ValOrig);
		this.ValOrig = null;
		this.NoteDiff = null;
		board.UpdateDOM();
	}
}
class CommandEditNoteSudoku {
	constructor(x, y, val) {
		this.x = x;
		this.y = y;
		this.val = val;
		this.ValOrig = null;
	}
	GetLabel() {
		return (
			"Set Notes at x = " + (this.x + 1) +
			", y = " + (this.y + 1) + " to " +
			GetLstNoteInt(this.val, 9).map((x) => { return "" + (x + 1); }).join(","));
	}
	execute(board) {
		if (this.ValOrig != null) {
			console.log("WARN: @execute(board): ValOrig != null");
		}
		var note = board.GetNote(this.x, this.y);
		this.ValOrig = note.z;
		note.z = this.val;
		board.UpdateDOM();
	}
	unexecute(board) {
		if (this.ValOrig == null) {
			console.log("WARN: @unexecute(board): ValOrig == null");
		}
		var note = board.GetNote(this.x, this.y);
		note.z = this.ValOrig;
		this.ValOrig = null;
		board.UpdateDOM();
	}
}

window.Sudoku = {};
$(document).ready(function () {
	let _ = null;
	let board = null;
  /*board = [
		[2, _, 9, _, 8, _, _, _, _],
		[7, _, _, _, _, 4, 9, 3, 5],
		[_, 6, _, _, 5, 9, _, _, _],
		[_, _, 3, 6, 1, _, _, _, 4],
		[_, 7, 2, _, _, _, 6, 9, _],
		[4, _, _, _, 2, 3, 5, _, _],
		[_, _, _, 1, 7, _, _, 2, _],
		[8, 2, 1, 4, _, _, _, _, 9],
		[_, _, _, _, 9, _, 1, _, 8]];
  console.log("0: " + BoardToRLE(board));
	board = [
		[5, _, _, 2, 7, _, _, _, _],
		[_, 4, _, _, _, _, _, _, 1],
		[_, 9, _, 6, _, _, _, _, 8],
		[_, 7, 9, _, _, 8, 4, _, _],
		[6, _, _, _, _, _, _, _, 2],
		[_, _, 4, 1, _, _, 3, 7, _],
		[8, _, _, _, _, 6, _, 3, _],
		[4, _, _, _, _, _, _, 1, _],
		[_, _, _, _, 1, 2, _, _, 5]];
  console.log("1: " + BoardToRLE(board));
	board = [
		[_, 8, _, 9, _, 6, _, 2, _],
		[_, _, _, 8, 1, _, 7, _, 6],
		[_, _, _, _, _, _, _, 4, _],
		[2, _, _, 6, _, _, _, _, 7],
		[5, _, _, _, 3, _, _, _, 1],
		[3, _, _, _, _, 7, _, _, 4],
		[_, 5, _, _, _, _, _, _, _],
		[7, _, 2, _, 5, 8, _, _, _],
		[_, 9, _, 3, _, 2, _, 1, _]];
  console.log("2: " + BoardToRLE(board));
	board = [
		[_, 9, _, _, _, _, 7, _, 2],
		[5, _, _, _, 9, _, _, 3, _],
		[_, 4, 7, _, _, _, 1, 6, _],
		[_, _, 1, 7, _, 5, _, _, _],
		[_, _, _, _, _, _, _, _, _],
		[_, _, _, 6, _, 9, 4, _, _],
		[_, 8, 3, _, _, _, 2, 9, _],
		[_, 2, _, _, 8, _, _, _, 6],
		[7, _, 9, _, _, _, _, 4, _]];
  console.log("3: " + BoardToRLE(board));
	board = [
		[_, _, 6, _, 9, 3, _, _, _],
		[_, 2, _, 1, _, _, 9, _, _],
		[3, _, _, _, _, 5, _, _, _],
		[5, 4, 3, 6, 2, _, _, _, _],
		[7, _, _, _, _, _, _, _, 2],
		[_, _, _, _, 3, 7, 4, 5, 6],
		[_, _, _, 4, _, _, _, _, 1],
		[_, _, 1, _, _, 2, _, 4, _],
		[_, _, _, 7, 5, _, 8, _, _]];
  console.log("4: " + BoardToRLE(board));*/
	board = [
		[_, _, _, 5, _, _, 1, 4, 7],
		[7, 2, 3, _, _, _, _, _, _],
		[_, _, _, _, _, _, _, 2, _],
		[_, _, 8, 3, 7, 2, _, 6, _],
		[_, _, _, _, _, _, _, _, _],
		[_, 7, _, 4, 9, 8, 2, _, _],
		[_, 3, _, _, _, _, _, _, _],
		[_, _, _, _, _, _, 9, 5, 8],
		[8, 9, 4, _, _, 1, _, _, _]];
  //console.log("5: " + BoardToRLE(board));
  if (window.theBoard != null) board = window.theBoard;
	Sudoku.Board = new SudokuBoard(document.getElementById("sudoku"));
	let nCols = Sudoku.Board.nCols;
	let nRows = Sudoku.Board.nRows;
	let Lst = Sudoku.Board.LstTable;
	let MASK = 511;
	for (let c = 0; c < nRows; ++c) {
		for (let c1 = 0; c1 < nCols; ++c1) {
			Sudoku.Board.GetNote(c1, c).z = MASK;
		}
	}
	for (let c = 0; c < nRows; ++c) {
		for (let c1 = 0; c1 < nCols; ++c1) {
			if (board[c][c1] == null) continue;
			Sudoku.Board.SetElemSmart(c1, c, board[c][c1] - 1);
		}
	}
	Sudoku.Board.UpdateDOM();
	Sudoku.Sel = null;
	Sudoku.$EditPane = $("#EditPane");
	Sudoku.$ep_p = Sudoku.$EditPane.find(">p#text");
	Sudoku.$ep_entry = Sudoku.$EditPane.find(">input[type='text']");
	Sudoku.$ep_btn = Sudoku.$EditPane.find(">button[name='change']")
	Sudoku.$ActBtns = Sudoku.$EditPane.find(">div#actBtns");
	Sudoku.$ep_undo = Sudoku.$ActBtns.find(">button[name='undo']");
	Sudoku.$ep_redo = Sudoku.$ActBtns.find(">button[name='redo']");
	Sudoku.$ep_tblHL = Sudoku.$EditPane.find(">div#highlight>table");
	Sudoku.$ep_tblNotes = Sudoku.$EditPane.find(">div#EditNote>table");
	let $trHL = Sudoku.$ep_tblHL.find(">tbody>tr");
	Sudoku.$ClkHL = $();
	for (let c = 0; c < $trHL.length; ++c) {
		let Cur = $($trHL[c]).find(">td");
		for (let c1 = 0; c1 < Cur.length; ++c1) {
			Sudoku.$ClkHL = Sudoku.$ClkHL.add(Cur[c1]);
		}
	}
	for (let c = 0; c < Sudoku.$ClkHL.length; ++c) {
		$(Sudoku.$ClkHL[c]).data({n: c});
	}
	Sudoku.Board.ClkHL = Sudoku.$ClkHL;
	Sudoku.$ClkHL.on("click", function (e) {
		var $self = $(this);
		var val = $self.hasClass("hl");
		Sudoku.$ClkHL.removeClass("hl");
		if (val) {
			Sudoku.Board.HighLight(null);
		} else {
			Sudoku.Board.HighLight($self.data().n);
			$self.addClass("hl");
		}
	});
	let $trNotes = Sudoku.$ep_tblNotes.find(">tbody>tr");
	Sudoku.$ClkNotes = $();
	for (let c = 0; c < $trNotes.length; ++c) {
		let Cur = $($trNotes[c]).find(">td");
		for (let c1 = 0; c1 < Cur.length; ++c1) {
			Sudoku.$ClkNotes = Sudoku.$ClkNotes.add(Cur[c1]);
		}
	}
	for (let c = 0; c < Sudoku.$ClkNotes.length; ++c) {
		$(Sudoku.$ClkNotes[c]).data({n: c});
	}
	Sudoku.$ClkNotes.on("click", function (e) {
		if (Sudoku.Sel == null) return;
		var $self = $(this);
		$self.toggleClass("note_present");
		var val = $self.hasClass("note_present");
		var note = Sudoku.Sel.note;
		if (val) note.Set($self.data().n);
		else note.Clr($self.data().n);
	});
	Sudoku.$ep_undo.on("click", function (e) {
		Sudoku.Board.Undo();
	});

	Sudoku.$ep_redo.on("click", function (e) {
		Sudoku.Board.Redo();
	});

	Sudoku.Board.AddCmdHook(function (board) {
		var lbl = board.GetUndoLabel();
		if (lbl != null) Sudoku.$ep_undo.attr("title", "Undo: " + lbl).prop("disabled", false);
		else Sudoku.$ep_undo.attr("title", "Undo").prop("disabled", true);
		lbl = board.GetRedoLabel();
		if (lbl != null) Sudoku.$ep_redo.attr("title", "Redo: " + lbl).prop("disabled", false);
		else Sudoku.$ep_redo.attr("title", "Redo").prop("disabled", true);
		if (Sudoku.Sel != null) {
			Sudoku.Sel.note.z = board.GetNote(Sudoku.Sel.x, Sudoku.Sel.y).z;
			Sudoku.$ClkNotes.removeClass("note_present");
			for (let c = 0; c < Sudoku.$ClkNotes.length; ++c) {
				if (Sudoku.Sel.note.Get(c)) {
					$(Sudoku.$ClkNotes[c]).addClass("note_present");
				}
			}
		}
	});

	Sudoku.Board.ExecCmdHooks();

	Sudoku.$ep_btn.on("click", function (e) {
		if (Sudoku.Sel == null) return;
		var val = Sudoku.$ep_entry[0].value;
		var x = Sudoku.Sel.x;
		var y = Sudoku.Sel.y;
		if (
			val.length !== 0 &&
			(val = Number(Sudoku.$ep_entry[0].value) - 1) !== Sudoku.Board.GetElem(x, y)) {
			Sudoku.Board.ExecuteCommand(new CommandEditSudoku(x, y, val));
		}
		var note = Sudoku.Sel.note;
		if (note.z !== Sudoku.Board.GetNote(x, y).z) {
			Sudoku.Board.ExecuteCommand(new CommandEditNoteSudoku(x, y, note.z));
		}
	});
	Sudoku.$ep_entry.on("keypress", function (e) {
		if (e.keyCode === 13) {
			Sudoku.$ep_btn.click();
		}
	});
	$(Sudoku.Board.Dom).find("td").on("click", function (e) {
		var $self = $(this);
		var data = $self.data();
		var x = data.col;
		var y = data.row;
		if (Sudoku.Sel != null) {
			$(Sudoku.Sel.elem).removeClass("sel");
		}
		Sudoku.Sel = {x: x, y: y, elem: this, note: null};
		$self.addClass("sel");
		var $p = Sudoku.$ep_p;
		var $entry = Sudoku.$ep_entry;
		$p.text("Selected: x = " + (x + 1) + ", y = " + (y + 1));
		var val = Sudoku.Board.GetElem(x, y);
		Sudoku.Sel.note = new Note(Sudoku.Board.GetNote(x, y).z);
		if (val != null) val = "" + (val + 1);
		else val = "";
		Sudoku.$ClkNotes.removeClass("note_present");
		for (let c = 0; c < Sudoku.$ClkNotes.length; ++c) {
			if (Sudoku.Sel.note.Get(c)) {
				$(Sudoku.$ClkNotes[c]).addClass("note_present");
			}
		}
		$entry[0].value = val;
		$entry.focus();
	});
});
Sudoku.Saver = {
	Init: function () {
		this.dom = document.createElement("div");
		this.$dom = $(this.dom);
		this.$dom.attr({id: 'LinkPane'})
		this.a = document.createElement("a");
		this.$a = $(this.a);
		this.$a.attr({href: "#"}).text("link");
		this.url = document.createElement("p");
		this.btn = document.createElement("button");
		this.btn.innerText = "Hide Link";
		this.btn.onclick = function (e) {
			Sudoku.Saver.HideLink(this, e);
		}
		this.$dom.append(this.a);
		this.$dom.append(this.url);
		this.$dom.append(this.btn);
	},
	SetLink: function (lnk) {
		this.url.innerText = lnk;
		this.$a.attr({href: lnk});
	},
	ShowLink: function () {
		let loc = document.location;
		this.SetLink(
			loc.origin + loc.pathname + "?rle=" +
			BoardToRLE(Sudoku.Board.data.map((x) => {
				return x == null ? null : x + 1;
			}))
		);
		$("body").append(this.dom);
	},
	HideLink: function () {
		this.$dom.detach();
	}
}
Sudoku.Saver.Init();
function WebSudoku_Extractor(elem) {
	let Rtn = "[\n";
	for (let y = 0; y < elem.children.length; ++y) {
		let cur = elem.children[y];
		Rtn += "["
		for (let x = 0; x < cur.children.length; ++x) {
			let cur1 = cur.children[x];
			let val = cur1.children[0].value;
			if (val.length === 0) val = NaN;
			else val = Number(val);
			if (isNaN(val)) {
//				Rtn += "_";
					Rtn += "null";
			} else {
				Rtn += val;
			}
			if (x + 1 < cur.children.length) {
				Rtn += ", ";
			}
		}
		Rtn += "]"
		if (y + 1 < elem.children.length) {
			Rtn += ",\n";
		}
	}
	Rtn += "]";
	return Rtn;
}

function BoardToRLE(board) {
  board = Array.prototype.concat.apply([], board);
  let Rtn = "";
  let CurRun = 0;
  const a = "a".charCodeAt(0);
  for (let c = 0; c < board.length; ++c) {
    if (board[c] != null) {
      if (typeof board[c] !== "number") throw new Error("only numbers or null allowed in board");
      if (board[c] % 1 !== 0) throw new Error("only positive integers allowed in board");
      if (board[c] < 1) throw new Error("only 1,2,3,4,5,6,7,8,9 are allowed in board");
      if (board[c] > 9) throw new Error("only 1,2,3,4,5,6,7,8,9 are allowed in board");
      if (CurRun > 25) {
        Rtn += "0" + CurRun + "a";
      } else if (CurRun) {
        Rtn += String.fromCharCode(a + CurRun);
      }
      CurRun = 0;
      Rtn += board[c];
    } else ++CurRun;
  }
  return Rtn;
}
function ExtractWebSudoku() {
	var elem = document.getElementById("puzzle_grid");
	var Str = WebSudoku_Extractor(elem.children[0])
	console.log(Str);
	console.log("RLE: " + BoardToRLE(JSON.parse(Str)));
}
if (document.URL.startsWith("http://show.websudoku.com")) ExtractWebSudoku();
else console.log("Not Extracting: " + document.URL);
