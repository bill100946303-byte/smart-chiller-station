function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeKnowledgeList(items) {
  return Array.isArray(items)
    ? items.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
}

function deriveKnowledgeStructure(localized) {
  const details = normalizeKnowledgeList(localized?.details);
  const checkFirst = normalizeKnowledgeList(localized?.checkFirst);
  const riskNotes = normalizeKnowledgeList(localized?.riskNotes);

  if (checkFirst.length > 0 || riskNotes.length > 0) {
    return {
      details,
      checkFirst,
      riskNotes
    };
  }

  return {
    details,
    checkFirst: details.slice(0, 2),
    riskNotes: details.length > 2 ? details.slice(2) : details.slice(-1)
  };
}

function localizeKnowledgeAnswer(entry, locale) {
  const localized = entry[locale] || entry.zh;
  const structure = deriveKnowledgeStructure(localized);
  return {
    id: entry.id,
    summary: localized.summary,
    details: structure.details,
    checkFirst: structure.checkFirst,
    riskNotes: structure.riskNotes
  };
}

const OPERATIONS_KNOWLEDGE_ENTRIES = [
  {
    id: "chilled-delta-t-low",
    match: {
      zh: ["冷冻水温差偏低", "冷冻水温差低", "冷冻水差偏低"],
      vi: ["chenh nhiet nuoc lanh thap", "delta t nuoc lanh thap"]
    },
    zh: {
      summary: "冷冻水温差偏低，常见含义是末端取冷不足、流量偏大，或传感器测值失真。",
      details: [
        "先看负荷侧是否真的在要冷，避免把低负荷工况误判成系统异常。",
        "再看冷冻泵频率、阀门开度和旁通是否过大，流量过高会直接拉低温差。",
        "若现场体感与趋势不一致，要优先排查供回水温度传感器漂移或安装位置问题。"
      ]
    },
    vi: {
      summary: "Chenh nhiet nuoc lanh thap thuong cho thay tai lanh khong du, luu luong qua lon, hoac cam bien do sai.",
      details: [
        "Truoc tien xem tai lanh thuc te co dang can lam lanh hay khong, tranh nham voi che do tai thap.",
        "Sau do xem toc do bom nuoc lanh, do mo van va duong bypass; luu luong qua lon se lam giam delta T.",
        "Neu hien truong va xu huong khong khop nhau, uu tien kiem tra cam bien nhiet do cap hoi nuoc lanh."
      ]
    }
  },
  {
    id: "cooling-delta-t-low",
    match: {
      zh: ["冷却水温差偏低", "冷却水温差低"],
      vi: ["chenh nhiet nuoc giai nhiet thap", "delta t nuoc giai nhiet thap"]
    },
    zh: {
      summary: "冷却水温差偏低，常见原因是冷却侧流量过大、塔侧换热不足，或负荷本身较低。",
      details: [
        "先看当前主机负荷和冷却泵频率，确认是不是低负荷下的正常小温差。",
        "若负荷不低，再查冷却塔风机、喷淋、填料和进风条件，确认换热是否有效。",
        "如果泵频率长期高但温差仍低，通常要回头检查流量分配和控制策略。"
      ]
    },
    vi: {
      summary: "Chenh nhiet nuoc giai nhiet thap thuong do luu luong qua lon, trao doi nhiet thap giai nhiet kem, hoac tai thap.",
      details: [
        "Truoc tien xem tai chiller hien tai va toc do bom nuoc giai nhiet, de loai tru truong hop tai thap.",
        "Neu tai khong thap, can kiem tra quat thap giai nhiet, phun nuoc, vat lieu dem va dieu kien thong gio.",
        "Neu bom chay tan so cao nhung delta T van thap, thuong can xem lai phan bo luu luong va chien luoc dieu khien."
      ]
    }
  },
  {
    id: "station-cop-low",
    match: {
      zh: ["站点cop偏低", "cop偏低", "cop低", "站点效率低"],
      vi: ["cop tram thap", "cop thap"]
    },
    zh: {
      summary: "站点 COP 偏低，通常不是单台设备问题，而是主机、泵、塔和流量控制共同造成的系统效率下降。",
      details: [
        "先分层看主机效率、冷冻泵、冷却泵和冷却塔效率，确认问题落在哪个子系统。",
        "再核对供回水温差、冷却侧换热和设备台数组合，很多低 COP 是工况匹配不合理导致的。",
        "如果负荷不高但辅机全开或频率偏高，往往会把站点 COP 明显拉低。"
      ]
    },
    vi: {
      summary: "COP tram thap thuong khong chi do mot thiet bi, ma do tong hop chiller, bom, thap va dieu khien luu luong.",
      details: [
        "Nen tach xem hieu suat chiller, bom nuoc lanh, bom nuoc giai nhiet va thap giai nhiet.",
        "Sau do doi chieu delta T, trao doi nhiet va so luong thiet bi dang chay de xem cong thai co phu hop khong.",
        "Neu tai khong cao nhung phu tai van chay nhieu hoac tan so cao, COP tram se giam ro."
      ]
    }
  },
  {
    id: "chiller-short-cycling",
    match: {
      zh: ["主机频繁启停", "频繁启停", "主机老是启停"],
      vi: ["chiller bat tat lien tuc", "khoi dong dung lien tuc"]
    },
    zh: {
      summary: "主机频繁启停，优先怀疑负荷波动大、启停阈值设置不合理，或联锁条件在边界附近反复抖动。",
      details: [
        "先看最近负荷、供回水温度和启停判据，确认是否是控制阈值过紧。",
        "再查最小运行时间、最小停机时间、台数切换逻辑和联锁保护是否生效。",
        "若启停同时伴随异常告警，要重点排查传感器抖动、流量联锁和保护误动作。"
      ]
    },
    vi: {
      summary: "Chiller bat tat lien tuc thuong lien quan den tai dao dong, nguong dieu khien qua chat, hoac dieu kien lien dong dao dong.",
      details: [
        "Nen xem tai gan day, nhiet do cap hoi nuoc va dieu kien bat tat co qua nhay hay khong.",
        "Sau do kiem tra thoi gian chay toi thieu, thoi gian dung toi thieu va logic doi so may.",
        "Neu kem theo canh bao, can uu tien xem cam bien, lien dong luu luong va bao ve co bi kich sai khong."
      ]
    }
  },
  {
    id: "chilled-pump-efficiency",
    match: {
      zh: ["冷冻泵效率异常", "冷冻泵效率低"],
      vi: ["hieu suat bom nuoc lanh bat thuong", "hieu suat bom nuoc lanh thap"]
    },
    zh: {
      summary: "冷冻泵效率异常，通常先看频率、流量、压差和阀门开度是否匹配，而不是先怀疑泵本体损坏。",
      details: [
        "先核对泵频率高不高、压差够不够、末端阀门是否大面积小开度运行。",
        "若频率高但压差和效果都一般，常见是系统阻力、旁通或控制策略有问题。",
        "只有在电流、振动、温升异常时，才更像泵或电机本体故障。"
      ]
    },
    vi: {
      summary: "Hieu suat bom nuoc lanh bat thuong thuong nen xem tan so, luu luong, ap chen va do mo van truoc khi nghi hu bom.",
      details: [
        "Truoc tien doi chieu tan so bom, ap chen va tinh trang mo van cua tai cuoi.",
        "Neu tan so cao nhung hieu qua khong ro, thuong lien quan den tro luc he thong, bypass hoac chien luoc dieu khien.",
        "Chi khi dong dien, rung hoac nhiet do than bom bat thuong moi nen nghi den loi bom hay dong co."
      ]
    }
  },
  {
    id: "cooling-pump-efficiency",
    match: {
      zh: ["冷却泵效率异常", "冷却泵效率低"],
      vi: ["hieu suat bom nuoc giai nhiet bat thuong", "hieu suat bom nuoc giai nhiet thap"]
    },
    zh: {
      summary: "冷却泵效率异常，重点要看它是不是在用过大的流量去换一个并不理想的冷却塔效果。",
      details: [
        "先比对冷却泵频率、冷却水温差和塔侧状态，确认泵高频是否真正换来了换热收益。",
        "若泵频率上去了但冷却水温差和主机冷凝侧工况没改善，常见是塔侧或分配问题。",
        "同时检查过滤器、管路阻塞和阀门状态，避免把水路问题误判为泵效率差。"
      ]
    },
    vi: {
      summary: "Hieu suat bom nuoc giai nhiet bat thuong can xem no co dang day luu luong lon nhung khong tao duoc hieu qua giai nhiet hay khong.",
      details: [
        "Nen so sanh tan so bom, delta T nuoc giai nhiet va trang thai thap de xem luu luong tang co tao loi ich that khong.",
        "Neu tan so tang nhung cong thai ngung tu va delta T khong cai thien, thuong la van de phia thap hoac phan bo nuoc.",
        "Dong thoi can xem loc, ong va van de tranh nham loi duong nuoc voi loi hieu suat bom."
      ]
    }
  },
  {
    id: "cooling-tower-poor-heat-exchange",
    match: {
      zh: ["冷却塔换热变差", "冷却塔效率差", "冷却塔效果差"],
      vi: ["thap giai nhiet trao doi nhiet kem", "hieu qua thap giai nhiet kem"]
    },
    zh: {
      summary: "冷却塔换热变差，通常会表现为冷却水出塔温偏高、温差偏小，且主机冷凝侧压力容易被带高。",
      details: [
        "先看风机运行、填料、喷淋和布水是否正常，再看天气和进风短路问题。",
        "若塔侧状态一般但出塔水温仍高，要检查并联塔分配是否失衡。",
        "冷却塔问题往往会放大到主机冷凝压力和站点 COP，不宜只盯塔本身。"
      ]
    },
    vi: {
      summary: "Thap giai nhiet trao doi nhiet kem thuong lam nuoc ra thap nong hon, delta T nho hon va ap ngung tu tang.",
      details: [
        "Truoc tien xem quat, vat lieu dem, he phun va phan bo nuoc co binh thuong khong, sau do moi den dieu kien gio va thoi tiet.",
        "Neu trang thai thap khong qua xau nhung nuoc ra van nong, can xem phan bo tai giua cac thap co lech khong.",
        "Van de thap thuong se anh huong den ap ngung tu va COP tram, khong nen chi nhin rieng thap."
      ]
    }
  },
  {
    id: "total-power-rise",
    match: {
      zh: ["总功率突然升高", "总功率升高", "功率突然升高"],
      vi: ["tong cong suat tang dot ngot", "cong suat tang dot ngot"]
    },
    zh: {
      summary: "总功率突然升高，先确认是负荷抬升带来的正常响应，还是辅机、台数或控制策略异常导致的额外耗电。",
      details: [
        "先看同一时段负荷、台数变化和泵塔频率，判断功率升高有没有业务原因。",
        "若负荷没明显抬升，但辅机频率、台数或冷凝侧工况恶化，就要优先排查控制策略。",
        "若只有单台设备功率异常抬升，再下钻看该设备电流、效率和联锁状态。"
      ]
    },
    vi: {
      summary: "Tong cong suat tang dot ngot can xem do tai tang binh thuong hay do phu tai, so may hoac dieu khien gay ton dien them.",
      details: [
        "Nen doi chieu tai, so may dang chay va tan so bom quat trong cung thoi diem.",
        "Neu tai khong tang nhieu ma phu tai hoac cong thai ngung tu xau di, uu tien xem lai dieu khien.",
        "Neu chi mot thiet bi co cong suat tang cao, can dao sau vao dong dien, hieu suat va lien dong cua no."
      ]
    }
  },
  {
    id: "low-load-high-energy",
    match: {
      zh: ["负荷不高但能耗偏高", "低负荷高能耗", "负荷低能耗高"],
      vi: ["tai thap nhung ton hao cao", "tai khong cao nhung ton hao cao"]
    },
    zh: {
      summary: "负荷不高但能耗偏高，最常见的不是主机效率骤降，而是台数、流量和辅机配置没有随负荷收回来。",
      details: [
        "先看主机是否开多了、泵塔频率是否偏高、旁通是否过大。",
        "再看冷冻水和冷却水温差是否偏低，低温差往往意味着流量在浪费。",
        "这类问题通常是系统协同效率差，单看一台设备往往看不出根因。"
      ]
    },
    vi: {
      summary: "Tai khong cao nhung ton hao cao thuong do so may, luu luong va phu tai khong giam theo tai, khong chi do chiller.",
      details: [
        "Truoc tien xem co mo qua nhieu chiller hay khong, tan so bom quat co dang cao qua muc can thiet khong.",
        "Sau do xem delta T nuoc lanh va nuoc giai nhiet co thap bat thuong khong.",
        "Day thuong la van de hieu suat tong he thong, khong nen chi nhin mot thiet bi."
      ]
    }
  },
  {
    id: "delta-t-sensor-or-equipment",
    match: {
      zh: ["供回水温差异常", "供回水温差不正常"],
      vi: ["delta t cap hoi bat thuong", "chenh nhiet cap hoi bat thuong"]
    },
    zh: {
      summary: "供回水温差异常时，先不要急着在“传感器故障”和“设备故障”里二选一，应该先做一致性校验。",
      details: [
        "先对照负荷、流量、阀门开度和体感，判断温差变化是否符合工况逻辑。",
        "若只有温度值异常，其他压力、流量、电流都稳定，更像传感器或测点问题。",
        "若温差异常同时伴随流量、功率或告警变化，再优先排查设备和控制。"
      ]
    },
    vi: {
      summary: "Khi delta T cap hoi bat thuong, khong nen vọi chon ngay giua loi cam bien va loi thiet bi, ma nen doi chieu tinh hop ly truoc.",
      details: [
        "Can doi chieu voi tai, luu luong, do mo van va hien tuong hien truong xem bien doi co hop logic hay khong.",
        "Neu chi nhiet do lech con ap, luu luong va dong dien van on dinh, thuong nghieng ve cam bien hoac diem do.",
        "Neu delta T lech kem theo luu luong, cong suat hoac canh bao thay doi, nen uu tien xem thiet bi va dieu khien."
      ]
    }
  },
  {
    id: "sensor-fault-signs",
    match: {
      zh: ["传感器故障", "像传感器故障", "不是设备故障"],
      vi: ["loi cam bien", "giong loi cam bien"]
    },
    zh: {
      summary: "更像传感器故障的典型特征，是单个点位跳变明显，但相关联的功率、压力、流量和现场现象并不跟着变化。",
      details: [
        "若数值突然跳零、跳满量程、长时间不动或与相邻点严重背离，都要先怀疑测点。",
        "若换一条关联链路看，系统工况仍然自洽，通常不应先判设备坏。",
        "传感器问题也会触发错误控制动作，所以排查时要同时看它有没有带来联锁误触发。"
      ]
    },
    vi: {
      summary: "Dau hieu giong loi cam bien la mot diem do nhay bat thuong, nhung cong suat, ap, luu luong va hien tuong thuc te khong doi theo.",
      details: [
        "Neu gia tri nhay ve 0, len het thang do, dung im lau hoac lech xa diem lien quan, can nghi den cam bien truoc.",
        "Neu doi chieu bang chuoi thong so khac ma cong thai he thong van hop ly, khong nen vọi ket luan thiet bi hong.",
        "Loi cam bien co the keo theo dieu khien sai, nen can xem no co gay lien dong sai hay khong."
      ]
    }
  },
  {
    id: "conflicting-telemetry",
    match: {
      zh: ["温度压力流量数据互相打架", "温度、压力、流量数据互相打架", "数据互相打架"],
      vi: ["du lieu mau thuan", "nhiet ap luu luong mau thuan"]
    },
    zh: {
      summary: "温度、压力、流量数据互相打架时，优先做物理逻辑校验，而不是直接相信任意一个点位。",
      details: [
        "先找最稳定的参考量，例如电流、频率、阀位、是否有实际告警，作为判断锚点。",
        "再看这些数据是否满足基本因果关系，例如流量变大是否应伴随压差和温差变化。",
        "若多条链路互相矛盾，优先回现场确认关键测点，再决定是否处置设备。"
      ]
    },
    vi: {
      summary: "Khi nhiet do, ap suat va luu luong mau thuan nhau, can uu tien kiem tra logic vat ly thay vi tin ngay vao mot diem do.",
      details: [
        "Nen tim thong so tham chieu on dinh hon nhu dong dien, tan so, vi tri van hoac canh bao thuc te.",
        "Sau do xem cac thong so co phu hop quan he nhan qua co ban hay khong.",
        "Neu nhieu chuoi mau thuan nhau, nen quay lai hien truong xac nhan diem do quan trong truoc khi xu ly thiet bi."
      ]
    }
  },
  {
    id: "serious-alarm-sequence",
    match: {
      zh: ["严重告警后", "严重告警", "标准处理顺序"],
      vi: ["canh bao nghiem trong", "trinh tu xu ly chuan"]
    },
    zh: {
      summary: "看到严重告警，标准顺序应是先确认安全和影响范围，再判断是真故障、假信号还是已恢复未复位。",
      details: [
        "第一步先看是否涉及人身安全、主机保护、联锁停机或业务连续性风险。",
        "第二步再看告警时间、来源、关联参数和现场现象，判断是否需要立即处置。",
        "第三步才是归因和恢复；没有完成安全确认前，不建议直接远程强行复位。"
      ]
    },
    vi: {
      summary: "Khi gap canh bao nghiem trong, thu tu dung la xac nhan an toan va pham vi anh huong truoc, roi moi phan biet that gia va trang thai da hoi phuc hay chua.",
      details: [
        "Buoc dau tien la xem co lien quan den an toan, bao ve chiller, dung lien dong hay rui ro van hanh khong.",
        "Buoc thu hai la doi chieu thoi diem, nguon, thong so lien quan va hien tuong hien truong.",
        "Chi sau khi xac nhan an toan moi xem den phuc hoi va reset; khong nen reset manh neu chua ro tinh hinh."
      ]
    }
  },
  {
    id: "on-site-confirm-first",
    match: {
      zh: ["先现场确认", "现场确认再看系统", "哪些异常需要先现场确认"],
      vi: ["can hien truong truoc", "uu tien xac nhan hien truong"]
    },
    zh: {
      summary: "涉及安全、联锁、设备异响异味、漏水漏电或传感器可信度明显不足的异常，都应先现场确认。",
      details: [
        "凡是可能误操作导致停机、冲击或安全风险的情况，都不适合只看系统画面下判断。",
        "若系统数据陈旧、缺数或互相矛盾，现场确认优先级也应上升。",
        "现场确认的目的不是替代系统，而是先建立一个可靠事实基线。"
      ]
    },
    vi: {
      summary: "Nhung bat thuong lien quan den an toan, lien dong, tieng on, mui la, ro ri dien nuoc hoac du lieu kem tin cay deu nen xac nhan hien truong truoc.",
      details: [
        "Neu thao tac sai co the gay dung may, soc tai hoac rui ro an toan, khong nen chi nhin man hinh de quyet.",
        "Khi du lieu cu, thieu hoac mau thuan nhau, uu tien hien truong can duoc nang len.",
        "Muc tieu cua viec ra hien truong la tao mot duong co so su that de doi chieu he thong."
      ]
    }
  },
  {
    id: "watch-not-immediate",
    match: {
      zh: ["继续观察", "不必立刻处置", "哪些异常可以先继续观察"],
      vi: ["co the tiep tuc theo doi", "chua can xu ly ngay"]
    },
    zh: {
      summary: "可以先观察、不必立刻处置的情况，通常是轻微偏差、短时波动，且没有连带告警、没有安全风险、没有业务影响。",
      details: [
        "如果异常值很快回归、趋势平稳、现场无异常体感，往往更适合先观察。",
        "但只要它开始影响主机保护、联锁、连续性或能耗，就不应再归为观察项。",
        "观察不等于忽略，仍应设定复核时间和升级条件。"
      ]
    },
    vi: {
      summary: "Tinh huong co the theo doi them thuong la sai lech nhe, dao dong ngan, khong co canh bao di kem, khong anh huong an toan va nghiep vu.",
      details: [
        "Neu gia tri nhanh chong tro lai binh thuong, xu huong on va hien truong khong co bat thuong, co the uu tien theo doi.",
        "Nhung neu no bat dau anh huong bao ve, lien dong, lien tuc van hanh hoac ton hao, thi khong nen tiep tuc de quan sat.",
        "Theo doi van phai co moc kiem tra lai va dieu kien nang muc xu ly."
      ]
    }
  },
  {
    id: "chiller-staging",
    match: {
      zh: ["主机台数配置不合理", "主机台数不合理"],
      vi: ["so luong chiller khong hop ly", "cau hinh so may khong hop ly"]
    },
    zh: {
      summary: "主机台数配置不合理，最直接的后果是部分机组长期低负荷、频繁切换，最终把站点 COP 和稳定性一起拉差。",
      details: [
        "台数过多时，常见表现是单机负荷太低、温差拉不开、辅机配合过度。",
        "台数过少时，则容易出现单机重载、告警变多、调节余量不足。",
        "判断是否合理，要同时看负荷、单机工况、切换频率和总站效率。"
      ]
    },
    vi: {
      summary: "So luong chiller bo tri khong hop ly se lam mot so may chay tai thap hoac doi may lien tuc, keo COP va do on dinh di xuong.",
      details: [
        "Mo qua nhieu may thuong lam tai tung may thap, delta T nho va phu tai phoi hop qua muc.",
        "Mo qua it may lai de gay tai nang, tang canh bao va giam du dia dieu chinh.",
        "Can danh gia dong thoi tai, cong thai tung may, tan suat chuyen may va hieu suat tong tram."
      ]
    }
  },
  {
    id: "pump-high-frequency-low-effect",
    match: {
      zh: ["泵频率过高但效果不明显", "频率过高但效果不明显", "泵频率高效果差"],
      vi: ["tan so bom cao nhung hieu qua thap", "bom chay nhanh nhung hieu qua kem"]
    },
    zh: {
      summary: "泵频率高但效果不明显，通常意味着系统阻力、流量分配或末端需求出了问题，而不是简单地“再加频率”。",
      details: [
        "先看压差、阀位、旁通和末端开度，确认流量是不是被浪费在无效回路里。",
        "再看过滤器、换热器和关键阀门是否存在堵塞、卡涩或失灵。",
        "这种场景继续抬泵频率，常常只会增加能耗，不会真正改善效果。"
      ]
    },
    vi: {
      summary: "Tan so bom cao nhung hieu qua thap thuong lien quan den tro luc, phan bo luu luong hoac nhu cau tai cuoi, khong phai cu tang tan so la du.",
      details: [
        "Can xem ap chen, do mo van, bypass va tinh trang tai cuoi de xem nuoc co dang di vao vong vo ich khong.",
        "Sau do kiem tra loc, bo trao doi nhiet va van quan trong co bi tac hay ket khong.",
        "Trong tinh huong nay, tang them tan so bom thuong chi lam ton dien them ma khong cai thien hieu qua that."
      ]
    }
  },
  {
    id: "tower-fan-poor-effect",
    match: {
      zh: ["冷却塔风机开了但效果差", "风机开了但效果差"],
      vi: ["quat thap da mo nhung hieu qua kem", "quat chay nhung hieu qua kem"]
    },
    zh: {
      summary: "冷却塔风机开了但效果差，不能只盯风机本身，还要同时查布水、填料、进风和并联系统分配。",
      details: [
        "先确认风机方向、转速和电流是否正常，再看填料、喷嘴和集水状态。",
        "若风机正常但出塔温仍高，要排查短路风、回流热风或并联塔分配失衡。",
        "塔风机问题最终会传导到冷凝压力和站点 COP，别只在塔侧局部处理。"
      ]
    },
    vi: {
      summary: "Quat thap da mo nhung hieu qua kem thi khong chi xem quat, ma phai xem ca phan bo nuoc, vat lieu dem, gio vao va phan bo tai giua cac thap.",
      details: [
        "Can xac nhan huong quat, toc do va dong dien truoc, sau do moi den vat lieu dem, be phun va tinh trang nuoc.",
        "Neu quat binh thuong nhung nuoc ra thap van nong, nen xem gio nong hoi luu, short-circuit gio hoac lech phan bo tai.",
        "Van de quat thap sau cung se anh huong den ap ngung tu va COP tram, khong nen xu ly cuc bo."
      ]
    }
  },
  {
    id: "night-shift-metrics",
    match: {
      zh: ["夜间值班", "夜班最该重点盯", "夜班该盯"],
      vi: ["truc dem", "ca dem nen theo doi gi"]
    },
    zh: {
      summary: "夜间值班最值得盯的不是所有点位，而是会直接影响安全、连续性和能耗失控的那几类关键指标。",
      details: [
        "优先看告警等级、主机启停、总功率、站点 COP、冷冻水温差和冷却侧工况。",
        "再看数据是否新鲜、是否缺数，避免值班时被陈旧数据误导。",
        "夜间更要关注是否出现持续异常而非瞬时跳点，因为持续问题最容易拖到交接班。"
      ]
    },
    vi: {
      summary: "Ca truc dem nen tap trung vao nhung chi so anh huong truc tiep den an toan, tinh lien tuc va ton hao, khong can nhin moi diem.",
      details: [
        "Nen uu tien canh bao, bat tat chiller, tong cong suat, COP tram, delta T nuoc lanh va cong thai phia giai nhiet.",
        "Dong thoi can xem du lieu co moi va day du khong de tranh bi du lieu cu dan sai.",
        "Ca dem can chu y cac bat thuong keo dai hon la cac diem nhay tuc thoi."
      ]
    }
  },
  {
    id: "shift-handoff",
    match: {
      zh: ["交接班", "交班", "交接最值得关注"],
      vi: ["giao ca", "ban giao ca"]
    },
    zh: {
      summary: "交接班最值得关注的，不是把所有页面都讲一遍，而是把未闭环风险、关键工况和待确认事项交清楚。",
      details: [
        "至少要讲清告警状态、当前台数、是否有异常工况、数据是否可信、以及下一步观察点。",
        "若存在陈旧数据、临时绕行或人工干预，也必须在交接时明确说明。",
        "好的交接班能显著降低重复误判和遗漏升级。"
      ]
    },
    vi: {
      summary: "Giao ca quan trong nhat la lam ro rui ro chua dong, cong thai hien tai va viec can xac nhan tiep theo, khong phai doc lai tat ca man hinh.",
      details: [
        "Can noi ro trang thai canh bao, so may dang chay, cong thai bat thuong, do tin cay cua du lieu va diem can theo doi tiep.",
        "Neu co du lieu cu, thao tac tam, duong vong hoac can thiep tay, can ghi ro khi giao ca.",
        "Giao ca tot se giam nham lan, bo sot va nang muc cham."
      ]
    }
  }
];

export function matchOperationsKnowledgeQuery(text, locale = "zh") {
  const normalized = normalizeText(text);
  if (!normalized) {
    return null;
  }

  for (const entry of OPERATIONS_KNOWLEDGE_ENTRIES) {
    const localeTerms = Array.isArray(entry.match?.[locale]) ? entry.match[locale] : [];
    const zhTerms = Array.isArray(entry.match?.zh) ? entry.match.zh : [];
    const viTerms = Array.isArray(entry.match?.vi) ? entry.match.vi : [];
    const allTerms = [...localeTerms, ...zhTerms, ...viTerms].filter(Boolean);
    if (allTerms.some((term) => normalized.includes(normalizeText(term)))) {
      return localizeKnowledgeAnswer(entry, locale);
    }
  }

  return null;
}
