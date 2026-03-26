// 下载功能
let styledExcelPromise;

function saveAs(obj, fileName) {
  var tmpa = document.createElement("a");
  tmpa.download = fileName || "未命名";
  // 兼容ie
  if ("msSaveOrOpenBlob" in navigator) {
    window.navigator.msSaveOrOpenBlob(obj, fileName);
  } else {
    tmpa.href = URL.createObjectURL(obj);
  }
  tmpa.click();
  setTimeout(function () {
    URL.revokeObjectURL(obj);
  }, 100);
}

function loadStyledExcel() {
  if (!styledExcelPromise) {
    styledExcelPromise = import(
      /* webpackChunkName: "xlsx-style-export" */ "xlsx-style"
    ).then((module) => module.default || module);
  }
  return styledExcelPromise;
}

export async function downloadExl(json, type, Title, mergelist) {
  const XLSX = await loadStyledExcel();
  let newarr = [];
  for (let i = 0; i < json.length; i++) {
    const inner = json[i];
    let inerarr = [];
    for (let j = 0; j < inner.length; j++) {
      const element = inner[j];
      let obj = {
        v: element ? element : "",
        position:
          (j > 25 ? getCharCol(j) : String.fromCharCode(65 + j)) + (i + 1),
      };
      inerarr.push(obj);
    }
    newarr.push(inerarr);
  }
  var tmpdata = []; // 用来保存转换好的json
  newarr
    .reduce((prev, next) => prev.concat(next))
    .forEach((v) => (tmpdata[v.position] = { v: v.v }));
  var outputPos = Object.keys(tmpdata); // 设置区域,比如表格从A1到D10
  for (const item of outputPos) {
    tmpdata[item].s = {
      alignment: { vertical: "center", horizontal: "center" },
    };
  }

  tmpdata["!merges"] = mergelist;
  tmpdata["!cols"] = new Array(16).fill({ wpx: 100, hpx: 60 });

  var tmpWB = {
    SheetNames: ["mySheet"],
    Sheets: {
      mySheet: Object.assign(
        {},
        tmpdata,
        {
          "!ref": outputPos[0] + ":" + outputPos[outputPos.length - 1],
        }
      ),
    },
  };
  var tmpDown = new Blob(
    [
      s2ab(
        XLSX.write(tmpWB, {
          bookType: type == undefined ? "xlsx" : type.bookType,
          bookSST: false,
          type: "binary",
        })
      ),
    ],
    {
      type: "",
    }
  );
  saveAs(
    tmpDown,
    Title + "." + (type.bookType == "biff2" ? "xls" : type.bookType)
  );
}

// 获取26个英文字母用来表示excel的列
function getCharCol(n) {
  let s = "";
  let m = 0;
  while (n > 0) {
    m = (n % 26) + 1;
    s = String.fromCharCode(m + 64) + s;
    n = (n - m) / 26;
  }
  return s;
}

function s2ab(s) {
  if (typeof ArrayBuffer !== "undefined") {
    var buf = new ArrayBuffer(s.length);
    var view = new Uint8Array(buf);
    for (var i = 0; i != s.length; ++i) view[i] = s.charCodeAt(i) & 0xff;
    return buf;
  } else {
    var oldBuf = new Array(s.length);
    for (var j = 0; j != s.length; ++j) oldBuf[j] = s.charCodeAt(j) & 0xff;
    return oldBuf;
  }
}
