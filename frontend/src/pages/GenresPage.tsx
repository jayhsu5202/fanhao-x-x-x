import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import { useMissavLocale } from "../context/MissavLocaleContext";

type LangKey = "zh-Hans" | "zh-Hant" | "en" | "ja" | "ko";
type TagItem = { query: string; label: Record<LangKey, string> };
type GroupItem = { group: Record<LangKey, string>; tags: TagItem[] };

const DATA: GroupItem[] = [
  {
    group: { "zh-Hans": "\u4e3b\u9898", "zh-Hant": "\u4e3b\u984c", en: "Theme", ja: "\u30c6\u30fc\u30de", ko: "\ud14c\ub9c8" },
    tags: [
      { query: "orgasm", label: { "zh-Hans": "\u6781\u81f4\u00b7\u6027\u9ad8\u6f6e", "zh-Hant": "\u6975\u81f4\u00b7\u6027\u9ad8\u6f6e", en: "Orgasm", ja: "\u7d76\u9802", ko: "\uc624\ub974\uac00\uc998" } },
      { query: "affair", label: { "zh-Hans": "\u51fa\u8f68", "zh-Hant": "\u5916\u9047", en: "Affair", ja: "\u4e0d\u502b", ko: "\uc678\ub3c4" } },
      { query: "asian", label: { "zh-Hans": "\u4e9a\u6d32", "zh-Hant": "\u4e9e\u6d32", en: "Asian", ja: "\u30a2\u30b8\u30a2", ko: "\uc544\uc2dc\uc544" } },
      { query: "bathing", label: { "zh-Hans": "\u6d17\u6d74", "zh-Hant": "\u6c90\u6d74", en: "Bathing", ja: "\u5165\u6d74", ko: "\ubaa9\uc695" } },
      { query: "beauty salon", label: { "zh-Hans": "\u7f8e\u5bb9\u9662", "zh-Hant": "\u7f8e\u5bb9\u9662", en: "Beauty Salon", ja: "\u30a8\u30b9\u30c6", ko: "\ubbf8\uc6a9\uc2e4" } },
      { query: "bizarre", label: { "zh-Hans": "\u5947\u5f02\u7684", "zh-Hant": "\u7375\u5947", en: "Bizarre", ja: "\u5947\u7570", ko: "\uae30\uc774\ud55c" } },
      { query: "breast fetish", label: { "zh-Hans": "\u604b\u4e73\u7656", "zh-Hant": "\u6200\u4e73\u7656", en: "Breast Fetish", ja: "\u5de8\u4e73\u30d5\u30a7\u30c1", ko: "\uc720\ubc29 \ud398\ud2f0\uc2dc" } },
      { query: "impregnation", label: { "zh-Hans": "\u53d7\u5b55", "zh-Hant": "\u53d7\u5b55", en: "Impregnation", ja: "\u5b55\u307e\u305b", ko: "\uc784\uc2e0" } },
      { query: "couple", label: { "zh-Hans": "\u60c5\u4fa3", "zh-Hant": "\u60c5\u4fb6", en: "Couple", ja: "\u30ab\u30c3\u30d7\u30eb", ko: "\ucee4\ud50c" } },
      { query: "guro", label: { "zh-Hans": "\u6b8b\u5fcd\u753b\u9762", "zh-Hant": "\u6b98\u5fcd\u756b\u9762", en: "Guro", ja: "\u30b0\u30ed", ko: "\uc794\ud639" } },
      { query: "daytime affair", label: { "zh-Hans": "\u767d\u5929\u51fa\u8f68", "zh-Hant": "\u767d\u665d\u5916\u9047", en: "Daytime Affair", ja: "\u663c\u9854\u59bb", ko: "\ub0ae \uc678\ub3c4" } },
      { query: "dance", label: { "zh-Hans": "\u8df3\u821e", "zh-Hant": "\u821e\u8e48", en: "Dance", ja: "\u30c0\u30f3\u30b9", ko: "\ub304\uc2a4" } },
      { query: "dark", label: { "zh-Hans": "\u6697\u9ed1\u7cfb", "zh-Hant": "\u6697\u9ed1\u7cfb", en: "Dark", ja: "\u30c0\u30fc\u30af\u7cfb", ko: "\ub2e4\ud06c" } },
      { query: "drunk", label: { "zh-Hans": "\u70c2\u9189\u5982\u6ce5", "zh-Hant": "\u721b\u9189", en: "Drunk", ja: "\u6ce5\u9154", ko: "\ub9cc\ucde8" } },
      { query: "delusion", label: { "zh-Hans": "\u5984\u60f3", "zh-Hant": "\u5984\u60f3", en: "Delusion", ja: "\u5984\u60f3", ko: "\ub9dd\uc0c1" } },
      { query: "fetish", label: { "zh-Hans": "\u604b\u7269\u7656", "zh-Hant": "\u6200\u7269\u7656", en: "Fetish", ja: "\u30d5\u30a7\u30c1", ko: "\ud398\ud2f0\uc2dc" } },
      { query: "french", label: { "zh-Hans": "\u6cd5\u56fd", "zh-Hant": "\u6cd5\u570b", en: "French", ja: "\u30d5\u30e9\u30f3\u30b9", ko: "\ud504\ub791\uc2a4" } },
      { query: "friendship", label: { "zh-Hans": "\u53cb\u8c0a", "zh-Hant": "\u53cb\u60c5", en: "Friendship", ja: "\u53cb\u60c5", ko: "\uc6b0\uc815" } },
      { query: "hermaphrodite", label: { "zh-Hans": "\u53cc\u6027\u4eba", "zh-Hant": "\u96d9\u6027\u4eba", en: "Hermaphrodite", ja: "\u3075\u305f\u306a\u308a", ko: "\ud6c4\ud0c0\ub098\ub9ac" } },
      { query: "gay", label: { "zh-Hans": "\u7537\u540c\u6027\u604b", "zh-Hant": "\u7537\u540c\u6027\u6200", en: "Gay", ja: "\u30b2\u30a4", ko: "\uac8c\uc774" } },
      { query: "hot spring", label: { "zh-Hans": "\u6e29\u6cc9", "zh-Hant": "\u6eab\u6cc9", en: "Hot Spring", ja: "\u6e29\u6cc9", ko: "\uc628\ucc9c" } },
      { query: "image club", label: { "zh-Hans": "\u5f62\u8c61\u4ff1\u4e50\u90e8", "zh-Hant": "\u5f62\u8c61\u4ff1\u6a02\u90e8", en: "Image Club", ja: "\u30a4\u30e1\u30af\u30e9", ko: "\uc774\ubbf8\uc9c0 \ud074\ub7fd" } },
      { query: "incest", label: { "zh-Hans": "\u4e71\u4f26", "zh-Hant": "\u4e82\u502b", en: "Incest", ja: "\u8fd1\u89aa\u76f8\u59e6", ko: "\uadfc\uce5c" } },
      { query: "korean", label: { "zh-Hans": "\u97e9\u56fd", "zh-Hant": "\u97d3\u570b", en: "Korean", ja: "\u97d3\u56fd", ko: "\ud55c\uad6d" } },
      { query: "leg fetish", label: { "zh-Hans": "\u604b\u817f\u7656", "zh-Hant": "\u6200\u817f\u7656", en: "Leg Fetish", ja: "\u811a\u30d5\u30a7\u30c1", ko: "\ub2e4\ub9ac \ud398\ud2f0\uc2dc" } },
      { query: "lesbian", label: { "zh-Hans": "\u5973\u540c\u6027\u604b", "zh-Hant": "\u5973\u540c\u6027\u6200", en: "Lesbian", ja: "\u30ec\u30ba", ko: "\ub808\uc988" } },
      { query: "lesbian kiss", label: { "zh-Hans": "\u5973\u540c\u63a5\u543b", "zh-Hant": "\u5973\u540c\u63a5\u543b", en: "Lesbian Kiss", ja: "\u30ec\u30ba\u30ad\u30b9", ko: "\ub808\uc988 \ud0a4\uc2a4" } },
      { query: "molestation", label: { "zh-Hans": "\u6027\u9a9a\u6270", "zh-Hant": "\u6027\u9a37\u64fe", en: "Molestation", ja: "\u75f4\u6f22", ko: "\ucd94\ud589" } },
      { query: "pickup", label: { "zh-Hans": "\u730e\u8273", "zh-Hant": "\u628a\u59b9", en: "Pickup", ja: "\u30ca\u30f3\u30d1", ko: "\ud5cc\ud305" } },
      { query: "orgy real", label: { "zh-Hans": "\u6deb\u4e71\u771f\u5b9e", "zh-Hant": "\u6deb\u4e82\u771f\u5be6", en: "Orgy / Real", ja: "\u4e71\u4ea4\u7d20\u4eba", ko: "\ub09c\uad50" } },
      { query: "normal", label: { "zh-Hans": "\u6b63\u5e38", "zh-Hant": "\u6b63\u5e38", en: "Normal", ja: "\u30ce\u30fc\u30de\u30eb", ko: "\uc77c\ubc18" } },
      { query: "fully nude", label: { "zh-Hans": "\u5168\u88f8", "zh-Hant": "\u5168\u88f8", en: "Fully Nude", ja: "\u5168\u88f8", ko: "\uc644\uc804 \ub204\ub4dc" } },
      { query: "other fetish", label: { "zh-Hans": "\u5176\u4ed6\u604b\u7269\u7656", "zh-Hant": "\u5176\u4ed6\u6200\u7269\u7656", en: "Other Fetish", ja: "\u305d\u306e\u4ed6\u30d5\u30a7\u30c1", ko: "\uae30\ud0c0 \ud398\ud2f0\uc2dc" } },
      { query: "voyeur", label: { "zh-Hans": "\u5077\u7aa5", "zh-Hant": "\u5077\u7aba", en: "Voyeur", ja: "\u76d7\u64ae", ko: "\ubab0\uce74" } },
      { query: "planning", label: { "zh-Hans": "\u4f01\u753b", "zh-Hant": "\u4f01\u5283", en: "Planning", ja: "\u4f01\u753b", ko: "\uae30\ud68d" } },
      { query: "prank", label: { "zh-Hans": "\u6076\u4f5c\u5267", "zh-Hant": "\u60e1\u4f5c\u5287", en: "Prank", ja: "\u3044\u305f\u305a\u3089", ko: "\uc7a5\ub09c" } },
      { query: "rape", label: { "zh-Hans": "\u5f3a\u5978", "zh-Hant": "\u5f37\u59e6", en: "Rape", ja: "\u30ec\u30a4\u30d7", ko: "\uac15\uac04" } },
      { query: "reverse", label: { "zh-Hans": "\u5012\u8ffd", "zh-Hant": "\u5012\u8ffd", en: "Reverse", ja: "\u9006\u30ca\u30f3", ko: "\uc5ed\ud5cc\ud305" } },
      { query: "school", label: { "zh-Hans": "\u5b66\u6821\u4f5c\u54c1", "zh-Hant": "\u5b78\u6821\u4f5c\u54c1", en: "School", ja: "\u5b66\u6821\u3082\u306e", ko: "\ud559\uad50\ubb3c" } },
      { query: "sexy", label: { "zh-Hans": "\u6027\u611f\u7684", "zh-Hant": "\u6027\u611f", en: "Sexy", ja: "\u30bb\u30af\u30b7\u30fc", ko: "\uc139\uc2dc" } },
      { query: "gender bender", label: { "zh-Hans": "\u6027\u8f6c\u6362\u5973\u4f53\u5316", "zh-Hant": "\u6027\u8f49\u63db\u5973\u9ad4\u5316", en: "Gender Bender", ja: "\u6027\u8ee2\u63db", ko: "\uc131\uc804\ud658" } },
      { query: "slave", label: { "zh-Hans": "\u5974\u96b6", "zh-Hant": "\u5974\u96b8", en: "Slave", ja: "\u5974\u96b7", ko: "\ub178\uc608" } },
      { query: "soapland", label: { "zh-Hans": "\u6ce1\u6cab\u6d74", "zh-Hant": "\u6ce1\u6cab\u6d74", en: "Soapland", ja: "\u30bd\u30fc\u30d7", ko: "\uc18c\ud504\ub79c\ub4dc" } },
      { query: "sports", label: { "zh-Hans": "\u8fd0\u52a8", "zh-Hant": "\u904b\u52d5", en: "Sports", ja: "\u30b9\u30dd\u30fc\u30c4", ko: "\uc2a4\ud3ec\uce20" } },
      { query: "m male", label: { "zh-Hans": "M\u7537", "zh-Hant": "M\u7537", en: "M Male", ja: "M\u7537", ko: "M\ub0a8" } },
      { query: "sweating", label: { "zh-Hans": "\u6d41\u6c57", "zh-Hant": "\u6d41\u6c57", en: "Sweating", ja: "\u6c57\u3060\u304f", ko: "\ub540" } },
      { query: "tentacle", label: { "zh-Hans": "\u89e6\u624b", "zh-Hant": "\u89f8\u624b", en: "Tentacle", ja: "\u89e6\u624b", ko: "\ucd09\uc218" } },
      { query: "time stop", label: { "zh-Hans": "\u65f6\u95f4\u505c\u6b62", "zh-Hant": "\u6642\u9593\u505c\u6b62", en: "Time Stop", ja: "\u6642\u9593\u505c\u6b62", ko: "\uc2dc\uac04\uc815\uc9c0" } },
      { query: "travel", label: { "zh-Hans": "\u65c5\u884c", "zh-Hant": "\u65c5\u884c", en: "Travel", ja: "\u65c5\u884c", ko: "\uc5ec\ud589" } },
      { query: "tsundere", label: { "zh-Hans": "\u86ee\u6a2a\u5a07\u7f9e", "zh-Hant": "\u883b\u6a6b\u5b0c\u7f9e", en: "Tsundere", ja: "\u30c4\u30f3\u30c7\u30ec", ko: "\uce24\ub370\ub808" } },
      { query: "virgin female", label: { "zh-Hans": "\u5904\u5973", "zh-Hant": "\u8655\u5973", en: "Virgin (Female)", ja: "\u51e6\u5973", ko: "\ucc98\ub140" } },
      { query: "virgin male", label: { "zh-Hans": "\u5904\u7537", "zh-Hant": "\u8655\u7537", en: "Virgin (Male)", ja: "\u7ae5\u8c9e", ko: "\ub3d9\uc815" } },
      { query: "youth", label: { "zh-Hans": "\u9752\u5e74", "zh-Hant": "\u9752\u5e74", en: "Youth", ja: "\u9752\u6625", ko: "\uccad\ucd98" } },
    ],
  },
  {
    group: { "zh-Hans": "\u89d2\u8272", "zh-Hant": "\u89d2\u8272", en: "Role", ja: "\u5f79", ko: "\uc5ed\ud560" },
    tags: [
      { query: "announcer", label: { "zh-Hans": "\u5973\u4e3b\u64ad", "zh-Hant": "\u5973\u4e3b\u64ad", en: "Announcer", ja: "\u30a2\u30ca\u30a6\u30f3\u30b5\u30fc", ko: "\uc544\ub098\uc6b4\uc11c" } },
      { query: "beautiful girl", label: { "zh-Hans": "\u7f8e\u5c11\u5973", "zh-Hant": "\u7f8e\u5c11\u5973", en: "Beautiful Girl", ja: "\u7f8e\u5c11\u5973", ko: "\ubbf8\uc18c\ub140" } },
      { query: "black actor", label: { "zh-Hans": "\u9ed1\u4eba\u6f14\u5458", "zh-Hant": "\u9ed1\u4eba\u6f14\u54e1", en: "Black Actor", ja: "\u9ed2\u4eba", ko: "\ud751\uc778" } },
      { query: "campaign girl", label: { "zh-Hans": "\u5c55\u573a\u5973\u5b69", "zh-Hant": "\u5c55\u5834\u5973\u5b69", en: "Campaign Girl", ja: "\u30ad\u30e3\u30f3\u30ae\u30e3\u30eb", ko: "\ucea0\ud398\uc778\uac78" } },
      { query: "bride", label: { "zh-Hans": "\u65b0\u5a18\u5e74\u8f7b\u59bb\u5b50", "zh-Hant": "\u65b0\u5a18\u5e74\u8f15\u59bb\u5b50", en: "Bride/Young Wife", ja: "\u82b1\u5ac1\u82e5\u59bb", ko: "\uc2e0\ubd80" } },
      { query: "childhood friend", label: { "zh-Hans": "\u7ae5\u5e74\u670b\u53cb", "zh-Hant": "\u9752\u6885\u7af9\u99ac", en: "Childhood Friend", ja: "\u5e7c\u306a\u3058\u307f", ko: "\uc18c\uafc9\uce5c\uad6c" } },
      { query: "cosplayer", label: { "zh-Hans": "\u89d2\u8272\u626e\u6f14\u8005", "zh-Hant": "\u89d2\u8272\u626e\u6f14\u8005", en: "Cosplayer", ja: "\u30b3\u30b9\u30d7\u30ec\u30a4\u30e4\u30fc", ko: "\ucf54\uc2a4\ud50c\ub808\uc774\uc5b4" } },
      { query: "daughter", label: { "zh-Hans": "\u5973\u513f", "zh-Hant": "\u5973\u5152", en: "Daughter", ja: "\u5a18", ko: "\ub538" } },
      { query: "entertainer", label: { "zh-Hans": "\u827a\u4eba", "zh-Hant": "\u85dd\u4eba", en: "Entertainer", ja: "\u82b8\u80fd\u4eba", ko: "\uc5f0\uc608\uc778" } },
      { query: "older man", label: { "zh-Hans": "\u9ad8\u9f84\u7537", "zh-Hant": "\u9ad8\u9f61\u7537", en: "Older Man", ja: "\u8001\u4eba", ko: "\ub178\uc778" } },
      { query: "college girl", label: { "zh-Hans": "\u5973\u5927\u5b66\u751f", "zh-Hant": "\u5973\u5927\u5b78\u751f", en: "College Girl", ja: "\u5973\u5b50\u5927\u751f", ko: "\uc5ec\ub300\uc0dd" } },
      { query: "female teacher", label: { "zh-Hans": "\u5973\u6559\u5e08", "zh-Hant": "\u5973\u6559\u5e2b", en: "Female Teacher", ja: "\u5973\u6559\u5e2b", ko: "\uc5ec\uad50\uc0ac" } },
      { query: "fighter", label: { "zh-Hans": "\u683c\u6597\u5bb6", "zh-Hant": "\u683c\u9b25\u5bb6", en: "Fighter", ja: "\u683c\u95d8\u5bb6", ko: "\uaca9\ud22c\uac00" } },
      { query: "freeter", label: { "zh-Hans": "\u98de\u7279\u65cf", "zh-Hant": "\u98db\u7279\u65cf", en: "Freeter", ja: "\u30d5\u30ea\u30fc\u30bf\u30fc", ko: "\ud504\ub9ac\ud130" } },
      { query: "gal", label: { "zh-Hans": "\u8fa3\u59b9", "zh-Hant": "\u8fa3\u59b9", en: "Gal", ja: "\u30ae\u30e3\u30eb", ko: "\uac38\ub8e8" } },
      { query: "hostess", label: { "zh-Hans": "\u793c\u4eea\u5c0f\u59d0", "zh-Hant": "\u79ae\u5100\u5c0f\u59d0", en: "Hostess", ja: "\u30b3\u30f3\u30d1\u30cb\u30aa\u30f3", ko: "\ub3c4\uc6b0\ubbf8" } },
      { query: "idol", label: { "zh-Hans": "\u5076\u50cf", "zh-Hant": "\u5076\u50cf", en: "Idol", ja: "\u30a2\u30a4\u30c9\u30eb", ko: "\uc544\uc774\ub3cc" } },
      { query: "instructor", label: { "zh-Hans": "\u8bb2\u5e08", "zh-Hant": "\u8b1b\u5e2b", en: "Instructor", ja: "\u30a4\u30f3\u30b9\u30c8\u30e9\u30af\u30bf\u30fc", ko: "\uac15\uc0ac" } },
      { query: "landlady", label: { "zh-Hans": "\u8001\u677f\u5a18", "zh-Hant": "\u8001\u95c6\u5a18", en: "Landlady", ja: "\u5973\u5c06", ko: "\ub9c8\ub2f4" } },
      { query: "celebrity look", label: { "zh-Hans": "\u660e\u661f\u8138", "zh-Hant": "\u660e\u661f\u81c9", en: "Celebrity Look", ja: "\u82b8\u80fd\u4eba\u4f3c", ko: "\uc5f0\uc608\uc778 \ub2ee\uc740\uaf34" } },
      { query: "married woman", label: { "zh-Hans": "\u5df2\u5a5a\u5987\u5973", "zh-Hant": "\u5df2\u5a5a\u5a66\u5973", en: "Married Woman", ja: "\u4eba\u59bb", ko: "\uc720\ubd80\ub140" } },
      { query: "ojousama", label: { "zh-Hans": "\u5927\u5c0f\u59d0", "zh-Hant": "\u5927\u5c0f\u59d0", en: "Ojousama", ja: "\u304a\u5b22\u69d8", ko: "\uc544\uac00\uc528" } },
      { query: "model", label: { "zh-Hans": "\u6a21\u7279\u513f", "zh-Hant": "\u6a21\u7279\u5152", en: "Model", ja: "\u30e2\u30c7\u30eb", ko: "\ubaa8\ub378" } },
      { query: "mother", label: { "zh-Hans": "\u6bcd\u4eb2", "zh-Hant": "\u6bcd\u89aa", en: "Mother", ja: "\u6bcd\u89aa", ko: "\uc5b4\uba38\ub2c8" } },
      { query: "stepmother", label: { "zh-Hans": "\u540e\u6bcd", "zh-Hant": "\u5f8c\u6bcd", en: "Stepmother", ja: "\u7fa9\u6bcd", ko: "\uacc4\ubaa8" } },
      { query: "nurse", label: { "zh-Hans": "\u62a4\u58eb", "zh-Hant": "\u8b77\u58eb", en: "Nurse", ja: "\u30ca\u30fc\u30b9", ko: "\uac04\ud638\uc0ac" } },
      { query: "older sister", label: { "zh-Hans": "\u59d0\u59d0", "zh-Hant": "\u59d0\u59d0", en: "Older Sister", ja: "\u304a\u59c9\u3055\u3093", ko: "\uc5b8\ub2c8" } },
      { query: "asian actress", label: { "zh-Hans": "\u4e9a\u6d32\u5973\u6f14\u5458", "zh-Hant": "\u4e9e\u6d32\u5973\u6f14\u54e1", en: "Asian Actress", ja: "\u30a2\u30b8\u30a2\u5973\u512a", ko: "\uc544\uc2dc\uc544 \uc5ec\ubc30\uc6b0" } },
      { query: "other student", label: { "zh-Hans": "\u5176\u4ed6\u5b66\u751f", "zh-Hant": "\u5176\u4ed6\u5b78\u751f", en: "Other Student", ja: "\u305d\u306e\u4ed6\u5b66\u751f", ko: "\uae30\ud0c0 \ud559\uc0dd" } },
      { query: "princess", label: { "zh-Hans": "\u516c\u4e3b", "zh-Hant": "\u516c\u4e3b", en: "Princess", ja: "\u30d7\u30ea\u30f3\u30bb\u30b9", ko: "\uacf5\uc8fc" } },
      { query: "prostitute", label: { "zh-Hans": "\u5993\u5973", "zh-Hant": "\u5993\u5973", en: "Prostitute", ja: "\u58f2\u6625\u5a66", ko: "\ub9e4\ucd98\ubd80" } },
      { query: "race queen", label: { "zh-Hans": "\u8d5b\u8f66\u5973\u90ce", "zh-Hant": "\u8cfd\u8eca\u5973\u90ce", en: "Race Queen", ja: "\u30ec\u30fc\u30b9\u30af\u30a4\u30fc\u30f3", ko: "\ub808\uc774\uc2a4\ud038" } },
      { query: "high school girl", label: { "zh-Hans": "\u9ad8\u4e2d\u5973\u751f", "zh-Hant": "\u9ad8\u4e2d\u5973\u751f", en: "High School Girl", ja: "\u5973\u5b50\u9ad8\u751f", ko: "\uc5ec\uace0\uc0dd" } },
      { query: "secretary", label: { "zh-Hans": "\u79d8\u4e66", "zh-Hant": "\u79d8\u66f8", en: "Secretary", ja: "\u79d8\u66f8", ko: "\ube44\uc11c" } },
      { query: "younger sister", label: { "zh-Hans": "\u59b9\u59b9", "zh-Hant": "\u59b9\u59b9", en: "Younger Sister", ja: "\u59b9", ko: "\uc5ec\ub3d9\uc0dd" } },
      { query: "slut", label: { "zh-Hans": "\u8361\u5987", "zh-Hant": "\u8569\u5a66", en: "Slut", ja: "\u6deb\u4e71", ko: "\ub09c\uc7a1\ud55c" } },
      { query: "tutor", label: { "zh-Hans": "\u5bb6\u6559", "zh-Hant": "\u5bb6\u6559", en: "Tutor", ja: "\u5bb6\u5ead\u6559\u5e2b", ko: "\uac00\uc815\uad50\uc0ac" } },
      { query: "various jobs", label: { "zh-Hans": "\u5404\u79cd\u804c\u4e1a", "zh-Hant": "\u5404\u7a2e\u8077\u696d", en: "Various Jobs", ja: "\u5404\u7a2e\u8077\u696d", ko: "\ub2e4\uc591\ud55c \uc9c1\uc5c5" } },
      { query: "waitress", label: { "zh-Hans": "\u670d\u52a1\u751f", "zh-Hant": "\u670d\u52d9\u751f", en: "Waitress", ja: "\u30a6\u30a7\u30a4\u30c8\u30ec\u30b9", ko: "\uc6e8\uc774\ud2b8\ub9ac\uc2a4" } },
      { query: "caucasian", label: { "zh-Hans": "\u767d\u4eba", "zh-Hant": "\u767d\u4eba", en: "Caucasian", ja: "\u767d\u4eba", ko: "\ubc31\uc778" } },
      { query: "widow", label: { "zh-Hans": "\u5be1\u5987", "zh-Hant": "\u5be1\u5a66", en: "Widow", ja: "\u672a\u4ea1\u4eba", ko: "\uacfc\ubd80" } },
      { query: "female doctor", label: { "zh-Hans": "\u5973\u533b\u751f", "zh-Hant": "\u5973\u91ab\u751f", en: "Female Doctor", ja: "\u5973\u533b", ko: "\uc5ec\uc758\uc0ac" } },
      { query: "female prosecutor", label: { "zh-Hans": "\u5973\u68c0\u5bdf\u5b98", "zh-Hant": "\u5973\u6aa2\u5bdf\u5b98", en: "Female Prosecutor", ja: "\u5973\u691c\u4e8b", ko: "\uc5ec\uac80\uc0ac" } },
      { query: "young girl", label: { "zh-Hans": "\u5e74\u8f7b\u5973\u5b69", "zh-Hant": "\u5e74\u8f15\u5973\u5b69", en: "Young Girl", ja: "\u82e5\u3044\u5973\u306e\u5b50", ko: "\uc80a\uc740 \uc5ec\uc790" } },
    ],
  },
  {
    group: { "zh-Hans": "\u670d\u88c5", "zh-Hant": "\u670d\u88dd", en: "Costume", ja: "\u8863\u88c5", ko: "\uc758\uc0c1" },
    tags: [
      { query: "anime character", label: { "zh-Hans": "\u52a8\u753b\u4eba\u7269", "zh-Hant": "\u52d5\u756b\u4eba\u7269", en: "Anime Character", ja: "\u30a2\u30cb\u30e1\u30ad\u30e3\u30e9", ko: "\uc560\ub2c8 \uce90\ub9ad\ud130" } },
      { query: "uniform jacket", label: { "zh-Hans": "\u5236\u670d\u5916\u5957", "zh-Hant": "\u5236\u670d\u5916\u5957", en: "Uniform Jacket", ja: "\u5236\u670d\u30b8\u30e3\u30b1\u30c3\u30c8", ko: "\uc81c\ubcf5 \uc7ac\ud0b7" } },
      { query: "bloomers", label: { "zh-Hans": "\u8fd0\u52a8\u77ed\u88e4", "zh-Hant": "\u904b\u52d5\u77ed\u8932", en: "Bloomers", ja: "\u30d6\u30eb\u30de", ko: "\ube14\ub8e8\uba38" } },
      { query: "bunny girl", label: { "zh-Hans": "\u5154\u5973\u90ce", "zh-Hant": "\u5154\u5973\u90ce", en: "Bunny Girl", ja: "\u30d0\u30cb\u30fc\u30ac\u30fc\u30eb", ko: "\ubc84\ub2c8\uac78" } },
      { query: "cat ears", label: { "zh-Hans": "\u732b\u8033\u5973", "zh-Hant": "\u8c93\u8033\u5973", en: "Cat Ears", ja: "\u732b\u8033", ko: "\uace0\uc591\uc774 \uadc0" } },
      { query: "cheongsam", label: { "zh-Hans": "\u65d7\u888d", "zh-Hant": "\u65d7\u888d", en: "Cheongsam", ja: "\u30c1\u30e3\u30a4\u30ca\u670d", ko: "\uce58\ud30c\uc624" } },
      { query: "cosplay", label: { "zh-Hans": "\u89d2\u8272\u626e\u6f14", "zh-Hant": "\u89d2\u8272\u626e\u6f14", en: "Cosplay", ja: "\u30b3\u30b9\u30d7\u30ec", ko: "\ucf54\uc2a4\ud504\ub808" } },
      { query: "crossdressing", label: { "zh-Hans": "\u5973\u88c5\u4eba\u5996", "zh-Hant": "\u5973\u88dd\u4eba\u5996", en: "Crossdressing", ja: "\u5973\u88c5", ko: "\uc5ec\uc7a5" } },
      { query: "doll", label: { "zh-Hans": "\u5a03\u5a03", "zh-Hant": "\u5a03\u5a03", en: "Doll", ja: "\u4eba\u5f62", ko: "\uc778\ud615" } },
      { query: "erotic clothing", label: { "zh-Hans": "\u7325\u4eb5\u7a7f\u7740", "zh-Hant": "\u7325\u893b\u7a7f\u8457", en: "Erotic Clothing", ja: "\u30a8\u30ed\u3044\u670d", ko: "\uc57c\ud55c \uc637" } },
      { query: "female ninja", label: { "zh-Hans": "\u5973\u5fcd\u8005", "zh-Hant": "\u5973\u5fcd\u8005", en: "Female Ninja", ja: "\u304f\u30ce\u4e00", ko: "\uc5ec\ub2cc\uc790" } },
      { query: "female warrior", label: { "zh-Hans": "\u5973\u6218\u58eb", "zh-Hant": "\u5973\u6230\u58eb", en: "Female Warrior", ja: "\u5973\u6226\u58eb", ko: "\uc5ec\uc804\uc0ac" } },
      { query: "glasses", label: { "zh-Hans": "\u773c\u955c", "zh-Hant": "\u773c\u93e1", en: "Glasses", ja: "\u30e1\u30ac\u30cd", ko: "\uc548\uacbd" } },
      { query: "hat", label: { "zh-Hans": "\u5e3d\u578b", "zh-Hant": "\u5e3d\u5b50\u578b", en: "Hat", ja: "\u5e3d\u5b50", ko: "\ubaa8\uc790" } },
      { query: "kimono", label: { "zh-Hans": "\u548c\u670d\u4e27\u670d", "zh-Hant": "\u548c\u670d\u55aa\u670d", en: "Kimono", ja: "\u7740\u7269", ko: "\uae30\ubaa8\ub178" } },
      { query: "knee socks", label: { "zh-Hans": "\u53ca\u819d\u889c", "zh-Hant": "\u53ca\u819d\u896a", en: "Knee Socks", ja: "\u30cb\u30fc\u30bd\u30c3\u30af\u30b9", ko: "\ubb34\ub98e \uc591\ub9d0" } },
      { query: "loose socks", label: { "zh-Hans": "\u6ce1\u6ce1\u889c", "zh-Hant": "\u6ce1\u6ce1\u896a", en: "Loose Socks", ja: "\u30eb\u30fc\u30ba\u30bd\u30c3\u30af\u30b9", ko: "\ub8e8\uc988 \uc0ad\uc2a4" } },
      { query: "leotard", label: { "zh-Hans": "\u7d27\u8eab\u8863", "zh-Hant": "\u7dca\u8eab\u8863", en: "Leotard", ja: "\u30ec\u30aa\u30bf\u30fc\u30c9", ko: "\ub808\uc624\ud0c0\ub4dc" } },
      { query: "lingerie", label: { "zh-Hans": "\u5185\u8863", "zh-Hant": "\u5167\u8863", en: "Lingerie", ja: "\u4e0b\u7740", ko: "\ub780\uc81c\ub9ac" } },
      { query: "gothic lolita", label: { "zh-Hans": "\u6b4c\u5fb7\u841d\u8389", "zh-Hant": "\u6b4c\u5fb7\u863f\u8389", en: "Gothic Lolita", ja: "\u30b4\u30b9\u30ed\u30ea", ko: "\uace0\uc2a4 \ub85c\ub9ac\ud0c0" } },
      { query: "long boots", label: { "zh-Hans": "\u957f\u9774", "zh-Hant": "\u9577\u9774", en: "Long Boots", ja: "\u30ed\u30f3\u30b0\u30d6\u30fc\u30c4", ko: "\ub871 \ubd80\uce20" } },
      { query: "maid", label: { "zh-Hans": "\u5973\u4f63", "zh-Hant": "\u5973\u50ad", en: "Maid", ja: "\u30e1\u30a4\u30c9", ko: "\uba54\uc774\ub4dc" } },
      { query: "mini skirt", label: { "zh-Hans": "\u8ff7\u4f60\u88d9", "zh-Hant": "\u8ff7\u4f60\u88d9", en: "Mini Skirt", ja: "\u30df\u30cb\u30b9\u30ab", ko: "\ubbf8\ub2c8\uc2a4\ucee4\ud2b8" } },
      { query: "mini skirt police", label: { "zh-Hans": "\u8ff7\u4f60\u88d9\u8b66\u5bdf", "zh-Hant": "\u8ff7\u4f60\u88d9\u8b66\u5bdf", en: "Mini Skirt Police", ja: "\u30df\u30cb\u30b9\u30ab\u8b66\u5bdf", ko: "\ubbf8\ub2c8\uc2a4\ucee4\ud2b8 \uacbd\ucc30" } },
      { query: "ultra mini skirt", label: { "zh-Hans": "\u8d85\u77ed\u88d9", "zh-Hant": "\u8d85\u77ed\u88d9", en: "Ultra Mini Skirt", ja: "\u8d85\u30df\u30cb\u30b9\u30ab", ko: "\ucd08\ubbf8\ub2c8\uc2a4\ucee4\ud2b8" } },
      { query: "naked apron", label: { "zh-Hans": "\u88f8\u4f53\u56f4\u88d9", "zh-Hant": "\u88f8\u9ad4\u570d\u88d9", en: "Naked Apron", ja: "\u88f8\u30a8\u30d7\u30ed\u30f3", ko: "\uc54c\ubab8 \uc55e\uce58\ub9c8" } },
      { query: "nun", label: { "zh-Hans": "\u4fee\u5973", "zh-Hant": "\u4fee\u5973", en: "Nun", ja: "\u30b7\u30b9\u30bf\u30fc", ko: "\uc218\ub140" } },
      { query: "ol", label: { "zh-Hans": "OL", "zh-Hant": "OL", en: "OL", ja: "OL", ko: "OL" } },
      { query: "pantyhose", label: { "zh-Hans": "\u8fde\u88e4\u889c", "zh-Hant": "\u9023\u8932\u896a", en: "Pantyhose", ja: "\u30d1\u30f3\u30b9\u30c8", ko: "\ud32c\ud2f0\uc2a4\ud0c0\ud0b9" } },
      { query: "shrine maiden", label: { "zh-Hans": "\u5973\u796d\u53f8", "zh-Hant": "\u5973\u796d\u53f8", en: "Shrine Maiden", ja: "\u5deb\u5973", ko: "\ubb34\ub140" } },
      { query: "sailor suit", label: { "zh-Hans": "\u6c34\u624b\u670d", "zh-Hant": "\u6c34\u624b\u670d", en: "Sailor Suit", ja: "\u30bb\u30fc\u30e9\u30fc\u670d", ko: "\uc138\uc77c\ub7ec\ubcf5" } },
      { query: "school swimsuit", label: { "zh-Hans": "\u5b66\u6821\u6cf3\u88c5", "zh-Hant": "\u5b78\u6821\u6cf3\u88dd", en: "School Swimsuit", ja: "\u30b9\u30af\u6c34", ko: "\uc2a4\ucfe8 \uc218\uc601\ubcf5" } },
      { query: "school uniform", label: { "zh-Hans": "\u6821\u670d", "zh-Hant": "\u6821\u670d", en: "School Uniform", ja: "\u5236\u670d", ko: "\uad50\ubcf5" } },
      { query: "stewardess", label: { "zh-Hans": "\u7a7a\u4e2d\u5c0f\u59d0", "zh-Hant": "\u7a7a\u4e2d\u5c0f\u59d0", en: "Stewardess", ja: "\u30b9\u30c1\u30e5\u30ef\u30fc\u30c7\u30b9", ko: "\uc2a4\ud29c\uc5b4\ub514\uc2a4" } },
      { query: "swimsuit", label: { "zh-Hans": "\u6cf3\u88c5", "zh-Hant": "\u6cf3\u88dd", en: "Swimsuit", ja: "\u6c34\u7740", ko: "\uc218\uc601\ubcf5" } },
      { query: "underwear", label: { "zh-Hans": "\u5185\u88e4", "zh-Hant": "\u5167\u8932", en: "Underwear", ja: "\u30d1\u30f3\u30c6\u30a3", ko: "\uc18d\uc637" } },
      { query: "uniform", label: { "zh-Hans": "\u5236\u670d", "zh-Hant": "\u5236\u670d", en: "Uniform", ja: "\u5236\u670d", ko: "\uc720\ub2c8\ud3fc" } },
      { query: "yukata", label: { "zh-Hans": "\u6d74\u8863", "zh-Hant": "\u6d74\u8863", en: "Yukata", ja: "\u6d74\u8863", ko: "\uc720\uce74\ud0c0" } },
    ],
  },
  {
    group: { "zh-Hans": "\u4f53\u578b", "zh-Hant": "\u9ad4\u578b", en: "Body Type", ja: "\u4f53\u578b", ko: "\uccb4\ud615" },
    tags: [
      { query: "fat woman", label: { "zh-Hans": "\u80d6\u5973\u4eba", "zh-Hant": "\u80d6\u5973\u4eba", en: "Fat Woman", ja: "\u30c7\u30d6", ko: "\ub6b1\ub6b1\ud55c \uc5ec\uc790" } },
      { query: "big breasts", label: { "zh-Hans": "\u5de8\u4e73", "zh-Hant": "\u5de8\u4e73", en: "Big Breasts", ja: "\u5de8\u4e73", ko: "\u5de8\u4e73" } },
      { query: "breasts", label: { "zh-Hans": "\u4e73\u623f", "zh-Hant": "\u4e73\u623f", en: "Breasts", ja: "\u304a\u3063\u3071\u3044", ko: "\uac00\uc2b4" } },
      { query: "ass", label: { "zh-Hans": "\u5c41\u80a1", "zh-Hant": "\u5c41\u80a1", en: "Ass", ja: "\u304a\u5c3b", ko: "\uc5c9\ub369\uc774" } },
      { query: "big ass", label: { "zh-Hans": "\u5de8\u5927\u5c41\u80a1", "zh-Hant": "\u5de8\u5927\u5c41\u80a1", en: "Big Ass", ja: "\u5de8\u5c3b", ko: "\ud070 \uc5c9\ub369\uc774" } },
      { query: "big penis", label: { "zh-Hans": "\u5de8\u5927\u9634\u830e", "zh-Hant": "\u5de8\u5927\u9670\u8396", en: "Big Penis", ja: "\u5de8\u6839", ko: "\ud070 \uc790\uc9c0" } },
      { query: "lolita", label: { "zh-Hans": "\u841d\u8389\u5854", "zh-Hant": "\u863f\u8389\u5854", en: "Lolita", ja: "\u30ed\u30ea\u30fc\u30bf", ko: "\ub85c\ub9ac\ud0c0" } },
      { query: "mature woman", label: { "zh-Hans": "\u6210\u719f\u7684\u5973\u4eba", "zh-Hant": "\u6210\u719f\u7684\u5973\u4eba", en: "Mature Woman", ja: "\u719f\u5973", ko: "\uc131\uc219\ud55c \uc5ec\uc790" } },
      { query: "petite", label: { "zh-Hans": "\u7626\u5c0f\u8eab\u578b", "zh-Hant": "\u7626\u5c0f\u8eab\u578b", en: "Petite", ja: "\u5c0f\u67c4", ko: "\uc791\uc740 \uccb4\ud615" } },
      { query: "muscular", label: { "zh-Hans": "\u808c\u8089", "zh-Hant": "\u808c\u8089", en: "Muscular", ja: "\u7b4b\u8089", ko: "\uadfc\uc721" } },
      { query: "pregnant", label: { "zh-Hans": "\u5b55\u5987", "zh-Hant": "\u5b55\u5a66", en: "Pregnant", ja: "\u598a\u5a66", ko: "\uc784\uc0b0\ubd80" } },
      { query: "hairless", label: { "zh-Hans": "\u65e0\u6bdb", "zh-Hant": "\u7121\u6bdb", en: "Hairless", ja: "\u7121\u6bdb", ko: "\ubb34\ubaa8" } },
      { query: "slim", label: { "zh-Hans": "\u82d7\u6761", "zh-Hant": "\u82d7\u689d", en: "Slim", ja: "\u30b9\u30ea\u30e0", ko: "\ub0a0\uc52c\ud55c" } },
      { query: "tanned", label: { "zh-Hans": "\u6652\u9ed1", "zh-Hant": "\u66ec\u9ed1", en: "Tanned", ja: "\u65e5\u713c\u3051", ko: "\ud0dc\ub2dd" } },
      { query: "tall", label: { "zh-Hans": "\u9ad8", "zh-Hant": "\u9ad8", en: "Tall", ja: "\u9ad8\u8eab\u9577", ko: "\ud0a4 \ud070" } },
      { query: "flat chest", label: { "zh-Hans": "\u5e73\u80f8", "zh-Hant": "\u5e73\u80f8", en: "Flat Chest", ja: "\u8ca7\u4e73", ko: "\ube48\uc720" } },
      { query: "transgender", label: { "zh-Hans": "\u53d8\u6027\u8005", "zh-Hant": "\u8b8a\u6027\u8005", en: "Transgender", ja: "\u30c8\u30e9\u30f3\u30b9\u30b8\u30a7\u30f3\u30c0\u30fc", ko: "\ud2b8\ub79c\uc2a4\uc820\ub354" } },
      { query: "hyper breasts", label: { "zh-Hans": "\u8d85\u4e73", "zh-Hant": "\u8d85\u4e73", en: "Hyper Breasts", ja: "\u8d85\u4e73", ko: "\ucd08\uc720" } },
    ],
  },
  {
    group: { "zh-Hans": "\u884c\u4e3a", "zh-Hant": "\u884c\u70ba", en: "Act", ja: "\u884c\u70ba", ko: "\ud589\uc704" },
    tags: [
      { query: "69", label: { "zh-Hans": "69", "zh-Hant": "69", en: "69", ja: "69", ko: "69" } },
      { query: "threesome+", label: { "zh-Hans": "\u591aP", "zh-Hant": "\u591aP", en: "Threesome+", ja: "3P\u4ee5\u4e0a", ko: "3P \uc774\uc0c1" } },
      { query: "anal", label: { "zh-Hans": "\u809b\u4ea4", "zh-Hant": "\u809b\u4ea4", en: "Anal", ja: "\u30a2\u30ca\u30eb", ko: "\ud56d\ubb38" } },
      { query: "blowjob", label: { "zh-Hans": "\u53e3\u4ea4", "zh-Hant": "\u53e3\u4ea4", en: "Blowjob", ja: "\u30d5\u30a7\u30e9", ko: "\ud3a0\ub77c\uce58\uc624" } },
      { query: "breast milk", label: { "zh-Hans": "\u6bcd\u4e73", "zh-Hant": "\u6bcd\u4e73", en: "Breast Milk", ja: "\u6bcd\u4e73", ko: "\ubaa8\uc720" } },
      { query: "facial", label: { "zh-Hans": "\u989c\u5c04", "zh-Hant": "\u984f\u5c04", en: "Facial", ja: "\u9854\u5c04", ko: "\uc548\uc0ac" } },
      { query: "scat", label: { "zh-Hans": "\u98df\u7caa", "zh-Hant": "\u98df\u7cde", en: "Scat", ja: "\u30b9\u30ab\u30c8\u30ed", ko: "\uc2a4\ucea3" } },
      { query: "cowgirl", label: { "zh-Hans": "\u5973\u4e0a\u4f4d", "zh-Hant": "\u5973\u4e0a\u4f4d", en: "Cowgirl", ja: "\u9a0e\u4e57\u4f4d", ko: "\uae30\uc2b9\uc704" } },
      { query: "creampie", label: { "zh-Hans": "\u4e2d\u51fa", "zh-Hant": "\u4e2d\u51fa", en: "Creampie", ja: "\u4e2d\u51fa\u3057", ko: "\uc911\ucd9c" } },
      { query: "swallowing", label: { "zh-Hans": "\u541e\u7cbe", "zh-Hant": "\u541e\u7cbe", en: "Swallowing", ja: "\u3054\u3063\u304f\u3093", ko: "\uc0bc\ud0a4\uae30" } },
      { query: "cunnilingus", label: { "zh-Hans": "\u8214\u9634", "zh-Hant": "\u8214\u9670", en: "Cunnilingus", ja: "\u30af\u30f3\u30cb", ko: "\ucfe4\ub2d0\ub9c1\uad6c\uc2a4" } },
      { query: "deep throat", label: { "zh-Hans": "\u6df1\u5589", "zh-Hant": "\u6df1\u5589", en: "Deep Throat", ja: "\u30c7\u30a3\u30fc\u30d7\u30b9\u30ed\u30fc\u30c8", ko: "\ub525\uc2a4\ub85c\ud2b8" } },
      { query: "dirty talk", label: { "zh-Hans": "\u6deb\u8bed", "zh-Hant": "\u6deb\u8a9e", en: "Dirty Talk", ja: "\u8a00\u8449\u8cac\u3081", ko: "\uc57c\ud55c \ub9d0" } },
      { query: "face sitting", label: { "zh-Hans": "\u989c\u9762\u9a91\u4e58", "zh-Hant": "\u984f\u9762\u9a0e\u4e58", en: "Face Sitting", ja: "\u9854\u9762\u9a0e\u4e57", ko: "\ud398\uc774\uc2a4 \uc2dc\ud305" } },
      { query: "fingering", label: { "zh-Hans": "\u624b\u6307\u63d2\u5165", "zh-Hant": "\u624b\u6307\u63d2\u5165", en: "Fingering", ja: "\u6307\u633f\u5165", ko: "\uc190\uac00\ub77d" } },
      { query: "fisting", label: { "zh-Hans": "\u62f3\u4ea4", "zh-Hant": "\u62f3\u4ea4", en: "Fisting", ja: "\u30d5\u30a3\u30b9\u30c8", ko: "\ud53c\uc2a4\ud305" } },
      { query: "foot job", label: { "zh-Hans": "\u8db3\u4ea4", "zh-Hant": "\u8db3\u4ea4", en: "Foot Job", ja: "\u8db3\u30b3\u30ad", ko: "\ud48b\uc7a1" } },
      { query: "handjob", label: { "zh-Hans": "\u6253\u624b\u67aa", "zh-Hant": "\u6253\u624b\u69cd", en: "Handjob", ja: "\u624b\u30b3\u30ad", ko: "\ud578\ub4dc\uc7a1" } },
      { query: "kissing", label: { "zh-Hans": "\u63a5\u543b", "zh-Hant": "\u63a5\u543b", en: "Kissing", ja: "\u30ad\u30b9", ko: "\ud0a4\uc2a4" } },
      { query: "massage", label: { "zh-Hans": "\u6309\u6469", "zh-Hant": "\u6309\u6469", en: "Massage", ja: "\u30de\u30c3\u30b5\u30fc\u30b8", ko: "\ub9c8\uc0ac\uc9c0" } },
      { query: "masturbation", label: { "zh-Hans": "\u81ea\u6170", "zh-Hant": "\u81ea\u6170", en: "Masturbation", ja: "\u30aa\u30ca\u30cb\u30fc", ko: "\uc790\uc704" } },
      { query: "pee drinking", label: { "zh-Hans": "\u996e\u5c3f", "zh-Hant": "\u98f2\u5c3f", en: "Pee Drinking", ja: "\u5c3f\u98f2\u307f", ko: "\uc624\uc90c \ub9c8\uc2dc\uae30" } },
      { query: "promiscuity", label: { "zh-Hans": "\u6ee5\u4ea4", "zh-Hant": "\u6feb\u4ea4", en: "Promiscuity", ja: "\u4e71\u4ea4", ko: "\ub09c\uad50" } },
      { query: "shower", label: { "zh-Hans": "\u6dcb\u6d74", "zh-Hant": "\u6dcb\u6d74", en: "Shower", ja: "\u30b7\u30e3\u30ef\u30fc", ko: "\uc0e4\uc6cc" } },
      { query: "squirting", label: { "zh-Hans": "\u6f6e\u5439", "zh-Hant": "\u6f6e\u5439", en: "Squirting", ja: "\u6f6e\u5439\u304d", ko: "\ubd84\uc218" } },
      { query: "titfuck", label: { "zh-Hans": "\u4e73\u4ea4", "zh-Hant": "\u4e73\u4ea4", en: "Titfuck", ja: "\u30d1\u30a4\u30ba\u30ea", ko: "\uac00\uc2b4 \uc139\uc2a4" } },
      { query: "pissing", label: { "zh-Hans": "\u653e\u5c3f", "zh-Hant": "\u653e\u5c3f", en: "Pissing", ja: "\u653e\u5c3f", ko: "\ubc29\ub1e8" } },
    ],
  },
  {
    group: { "zh-Hans": "\u73a9\u6cd5", "zh-Hant": "\u73a9\u6cd5", en: "Play", ja: "\u30d7\u30ec\u30a4", ko: "\ud50c\ub808\uc774" },
    tags: [
      { query: "humiliation", label: { "zh-Hans": "\u51cc\u8fb1", "zh-Hant": "\u51cc\u8fb1", en: "Humiliation", ja: "\u51cc\u8fb1", ko: "\uad74\uc695" } },
      { query: "bondage", label: { "zh-Hans": "\u7d27\u7f1a", "zh-Hant": "\u7dca\u7e1b", en: "Bondage", ja: "\u62d8\u675f", ko: "\uae34\ubc15" } },
      { query: "car sex", label: { "zh-Hans": "\u6c7d\u8f66\u6027\u7231", "zh-Hant": "\u6c7d\u8eca\u6027\u611b", en: "Car Sex", ja: "\u30ab\u30fc\u30bb\u30c3\u30af\u30b9", ko: "\ucc28 \uc139\uc2a4" } },
      { query: "candle", label: { "zh-Hans": "\u8721\u70db", "zh-Hant": "\u881f\u71ed", en: "Candle", ja: "\u308d\u3046\u305d\u304f", ko: "\uc591\ucd08" } },
      { query: "cervix", label: { "zh-Hans": "\u5b50\u5bab\u9888", "zh-Hant": "\u5b50\u5bae\u9838", en: "Cervix", ja: "\u5b50\u5bae\u53e3", ko: "\uc790\uad81\uacbd" } },
      { query: "confinement", label: { "zh-Hans": "\u76d1\u7981", "zh-Hant": "\u76e3\u7981", en: "Confinement", ja: "\u76e3\u7981", ko: "\uac10\uae08" } },
      { query: "drug", label: { "zh-Hans": "\u836f\u7269", "zh-Hant": "\u85e5\u7269", en: "Drug", ja: "\u85ac\u7269", ko: "\uc57d\ubb3c" } },
      { query: "vibrator", label: { "zh-Hans": "\u8df3\u86cb", "zh-Hant": "\u8df3\u86cb", en: "Vibrator", ja: "\u30d0\u30a4\u30d6", ko: "\uc9c4\ub3d9\uae30" } },
      { query: "magic wand", label: { "zh-Hans": "\u5973\u4f18\u6309\u6469\u68d2", "zh-Hant": "\u5973\u512a\u6309\u6469\u68d2", en: "Magic Wand", ja: "\u96fb\u30de", ko: "\uc804\ub3d9 \ub9c8\uc0ac\uc9c0" } },
      { query: "enema", label: { "zh-Hans": "\u704c\u80a0", "zh-Hant": "\u704c\u8178", en: "Enema", ja: "\u6d63\u8178", ko: "\uad00\uc7a5" } },
      { query: "exhibitionism", label: { "zh-Hans": "\u9732\u51fa", "zh-Hant": "\u9732\u51fa", en: "Exhibitionism", ja: "\u9732\u51fa", ko: "\ub178\ucd9c\uc99d" } },
      { query: "object insertion", label: { "zh-Hans": "\u63d2\u5165\u5f02\u7269", "zh-Hant": "\u63d2\u5165\u7570\u7269", en: "Object Insertion", ja: "\u7570\u7269\u633f\u5165", ko: "\uc774\ubb3c \uc0bd\uc785" } },
      { query: "gangbang", label: { "zh-Hans": "\u8f6e\u5978", "zh-Hant": "\u8f2a\u59e6", en: "Gangbang", ja: "\u8f2a\u59e6", ko: "\uc724\uac04" } },
      { query: "shame", label: { "zh-Hans": "\u7f9e\u803b", "zh-Hant": "\u7f9e\u6065", en: "Shame", ja: "\u7f9e\u6065", ko: "\uc218\uce58" } },
      { query: "hypnosis", label: { "zh-Hans": "\u50ac\u7720", "zh-Hant": "\u50ac\u7720", en: "Hypnosis", ja: "\u50ac\u7720", ko: "\ucd5c\uba74" } },
      { query: "quickie", label: { "zh-Hans": "\u5373\u5174\u6027\u4ea4", "zh-Hant": "\u5373\u8208\u6027\u4ea4", en: "Quickie", ja: "\u5373\u30cf\u30e1", ko: "\uc989\ud765 \uc139\uc2a4" } },
      { query: "lotion", label: { "zh-Hans": "\u4e73\u6db2", "zh-Hant": "\u4e73\u6db2", en: "Lotion", ja: "\u30ed\u30fc\u30b7\u30e7\u30f3", ko: "\ub85c\uc158" } },
      { query: "outdoor", label: { "zh-Hans": "\u6237\u5916", "zh-Hant": "\u6236\u5916", en: "Outdoor", ja: "\u91ce\u5916", ko: "\uc57c\uc678" } },
      { query: "forced", label: { "zh-Hans": "\u5f3a\u8feb", "zh-Hant": "\u5f37\u8feb", en: "Forced", ja: "\u5f37\u5236", ko: "\uac15\uc81c" } },
      { query: "restraint", label: { "zh-Hans": "\u62d8\u675f", "zh-Hant": "\u62d8\u675f", en: "Restraint", ja: "\u7dca\u7e1b", ko: "\uad6c\uc18d" } },
      { query: "feces", label: { "zh-Hans": "\u7caa\u4fbf", "zh-Hant": "\u7cde\u4fbf", en: "Feces", ja: "\u7cde", ko: "\ub300\ubcc0" } },
      { query: "sm", label: { "zh-Hans": "SM", "zh-Hant": "SM", en: "SM", ja: "SM", ko: "SM" } },
      { query: "rope bondage", label: { "zh-Hans": "\u7ef3\u7f1a", "zh-Hant": "\u7e69\u7e1b", en: "Rope Bondage", ja: "\u7dca\u7e1b", ko: "\ub85c\ud504 \uad6c\uc18d" } },
      { query: "speculum", label: { "zh-Hans": "\u9e2d\u5634", "zh-Hant": "\u9d28\u5634", en: "Speculum", ja: "\u30af\u30b9\u30b3", ko: "\uc9c8\uacbd" } },
      { query: "tickling", label: { "zh-Hans": "\u6414\u75d2", "zh-Hant": "\u6414\u7662", en: "Tickling", ja: "\u304f\u3059\u3050\u308a", ko: "\uac04\uc9c0\ub7fd\ud788\uae30" } },
      { query: "toys", label: { "zh-Hans": "\u73a9\u5177", "zh-Hant": "\u73a9\u5177", en: "Toys", ja: "\u304a\u3082\u3061\u3083", ko: "\uc7a5\ub09c\uac10" } },
      { query: "torture", label: { "zh-Hans": "\u62f7\u95ee", "zh-Hant": "\u62f7\u554f", en: "Torture", ja: "\u62f7\u554f", ko: "\uace0\ubb38" } },
      { query: "training", label: { "zh-Hans": "\u8c03\u6559", "zh-Hant": "\u8abf\u6559", en: "Training", ja: "\u8abf\u6559", ko: "\uc870\uad50" } },
      { query: "strip", label: { "zh-Hans": "\u8131\u8863", "zh-Hant": "\u812b\u8863", en: "Strip", ja: "\u8131\u8863", ko: "\uc2a4\ud2b8\ub9bd" } },
      { query: "catheter", label: { "zh-Hans": "\u5bfc\u5c3f", "zh-Hant": "\u5c0e\u5c3f", en: "Catheter", ja: "\u30ab\u30c6\u30fc\u30c6\u30eb", ko: "\uce74\ud14c\ud130" } },
      { query: "vibrator wand", label: { "zh-Hans": "\u6309\u6469\u68d2", "zh-Hant": "\u6309\u6469\u68d2", en: "Vibrator Wand", ja: "\u30d0\u30a4\u30d6\u68d2", ko: "\uc9c4\ub3d9 \ub9c9\ub300" } },
    ],
  },
];

export default function GenresPage() {
  const { locale } = useMissavLocale();
  const navigate = useNavigate();
  const lang = (locale as LangKey) in { "zh-Hans": 1, "zh-Hant": 1, en: 1, ja: 1, ko: 1 }
    ? (locale as LangKey)
    : "zh-Hant";
  const [filterText, setFilterText] = useState("");

  const filtered = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return DATA;
    return DATA.map((g) => ({
      ...g,
      tags: g.tags.filter(
        (t) =>
          t.query.toLowerCase().includes(q) ||
          Object.values(t.label).some((v) => v.toLowerCase().includes(q))
      ),
    })).filter((g) => g.tags.length > 0);
  }, [filterText]);

  function handleTag(query: string) {
    navigate(`/search?q=${encodeURIComponent(query)}`);
  }

  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="genres-page">
        <div className="genres-hero">
          <h1 className="genres-title">探索類型</h1>
          <p className="genres-sub">點擊標籤直接搜尋相關影片</p>
          <div className="genres-filter-wrap">
            <input
              className="genres-filter-input"
              placeholder="篩選標籤…"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              aria-label="篩選標籤"
            />
          </div>
        </div>
        <div className="genres-groups-grid">
          {filtered.map((g) => (
            <section key={g.group["zh-Hant"]} className="genres-section">
              <h2 className="genres-section-title">{g.group[lang]}</h2>
              <div className="genres-tag-grid">
                {g.tags.map((t) => (
                  <button
                    key={t.query}
                    type="button"
                    className="genres-tag-btn"
                    onClick={() => handleTag(t.label[lang] || t.query)}
                  >
                    {t.label[lang]}
                  </button>
                ))}
              </div>
            </section>
          ))}
          {filtered.length === 0 ? (
            <p className="msg-muted" style={{ padding: "2rem 0" }}>沒有符合的標籤。</p>
          ) : null}
        </div>
      </main>
    </div>
  );
}
