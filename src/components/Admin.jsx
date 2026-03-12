import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
} from "firebase/firestore";
import { MEMBERS } from "../config/members";
import { CATEGORIES } from "../config/categories";

const SAMPLE_JSON = `{
  "session": 1,
  "date": "2026-03-11",
  "questions": [
    {
      "id": "q1",
      "category": "E",
      "categoryName": "종결·사후관리",
      "difficulty": "hard",
      "type": "choice",
      "question": "서비스 종결 시 자동종결 대상에 해당하는 것은?",
      "options": [
        "① 재사정 결과 대상자 기준 부적합",
        "② 수행기관 종사자에게 지속적 폭언",
        "③ 이용자 사망",
        "④ 과도한 서비스 요구(연 3회 이상)"
      ],
      "answer": "③ **이용자 사망**",
      "basis": "**자동종결 대상** - 이용자 사망. **행복e음 변동알림** 정보를 통해 노인맞춤돌봄시스템 종결 처리",
      "page": "p.57",
      "note": "**자동종결·심의생략·협의체심의** 3가지 종결 유형을 구분할 것",
      "related": [
        {
          "title": "자동종결",
          "items": ["이용자 사망"]
        },
        {
          "title": "심의 생략 (시·군·구 승인)",
          "items": ["서비스 거부", "장기간(90일+) 중지", "자격상실(나이·소득·유사중복)", "타 서비스 이용"]
        },
        {
          "title": "협의체 심의 대상",
          "highlight": true,
          "items": ["재사정 결과 부적합", "종사자 안전상의 이유"]
        }
      ]
    },
    {
      "id": "q2",
      "category": "A",
      "categoryName": "서비스 대상·자격",
      "difficulty": "hard",
      "type": "essay",
      "question": "서술형 문제 내용",
      "answer": "모범 답안 내용",
      "basis": "근거 원문 인용",
      "page": "p.43",
      "note": "보충 설명"
    }
  ]
}`;

const PROMPT_TEMPLATE = `2026 노인맞춤돌봄서비스 사업안내 기반으로
N회차 퀴즈 JSON을 아래 형식으로 생성해줘.

구성:
- 기본 문제(선택형) 5문항: 범주 A~H 혼합
- 어려운 문제(선택형) 3문항: 조건 분기·변경사항·예외규정 중심
- 어려운 문제(서술형) 2문항: 실무 사례형

규칙:
- basis: 사업안내 원문을 그대로 인용
- page: 사업안내 문서 하단 페이지 번호
- note: 간단한 보충 설명 (필수)
- related: 혼동하기 쉬운 규정을 분류별로 비교 표시 (해당되는 문항만). highlight:true는 특히 주의할 항목.
- answer, basis, note 텍스트에서 핵심 용어는 **별표** 로 감싸기 (예: **자동종결 대상**). 화면에 노란 하이라이트로 표시됨.

출력 형식:
{
  "session": N,
  "date": "YYYY-MM-DD",
  "questions": [
    {
      "id": "q1",
      "category": "B",
      "categoryName": "서비스 시간·내용",
      "difficulty": "basic",
      "type": "choice",
      "question": "문제 내용",
      "options": ["① ...", "② ...", "③ ...", "④ ..."],
      "answer": "② 정답 내용",
      "basis": "사업안내 원문 인용",
      "page": "p.6",
      "note": "보충 설명",
      "related": [
        { "title": "분류A", "items": ["항목1", "항목2"] },
        { "title": "분류B", "highlight": true, "items": ["항목3"] }
      ]
    },
    {
      "id": "q9",
      "category": "A",
      "categoryName": "서비스 대상·자격",
      "difficulty": "hard",
      "type": "essay",
      "question": "서술형 문제 내용",
      "answer": "모범 답안 내용",
      "basis": "사업안내 원문 인용",
      "page": "p.43",
      "note": "보충 설명"
    }
  ]
}`;

export default function Admin() {
  const [jsonInput, setJsonInput] = useState("");
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [lastSession, setLastSession] = useState(0);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [showGuide, setShowGuide] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [sampleCopied, setSampleCopied] = useState(false);

  useEffect(() => {
    const fetchLast = async () => {
      const q = query(collection(db, "quiz_sessions"), orderBy("session", "desc"));
      const snap = await getDocs(q);
      if (!snap.empty) setLastSession(snap.docs[0].data().session || 0);
    };
    fetchLast();
  }, []);

  const handleValidate = () => {
    setError(""); setPreview(null); setSuccess("");
    try {
      const data = JSON.parse(jsonInput.trim());
      if (!data.questions || !Array.isArray(data.questions)) { setError("questions 배열이 필요합니다."); return; }
      if (data.questions.length === 0) { setError("문항이 하나 이상 있어야 합니다."); return; }
      for (const q of data.questions) {
        if (!q.id || !q.question || !q.answer) { setError(`문항 ${q.id || "?"}에 id, question, answer가 필요합니다.`); return; }
      }
      const nextSession = lastSession + 1;
      const date = data.date || new Date().toISOString().split("T")[0];
      const catDist = {}, diffDist = { basic: 0, hard: 0 }, typeDist = { choice: 0, essay: 0 };
      data.questions.forEach((q) => {
        catDist[q.category || "?"] = (catDist[q.category || "?"] || 0) + 1;
        if (q.difficulty) diffDist[q.difficulty] = (diffDist[q.difficulty] || 0) + 1;
        if (q.type) typeDist[q.type] = (typeDist[q.type] || 0) + 1;
      });
      setPreview({ session: nextSession, date, totalQuestions: data.questions.length, catDist, diffDist, typeDist, questions: data.questions });
    } catch (e) { setError("JSON 파싱 오류: " + e.message); }
  };

  const handleStart = async () => {
    if (!preview) return;
    setLoading(true); setError(""); setSuccess("");
    try {
      const progress = {};
      MEMBERS.forEach((name) => { progress[name] = "not_started"; });
      await addDoc(collection(db, "quiz_sessions"), {
        session: preview.session, date: preview.date, questions: preview.questions, progress,
      });
      setSuccess(`제${preview.session}회차가 시작되었습니다! (${preview.totalQuestions}문항)`);
      setLastSession(preview.session); setPreview(null); setJsonInput("");
    } catch (e) { setError("저장 실패: " + e.message); }
    finally { setLoading(false); }
  };

  const copyToClipboard = (text, setter) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="font-bold text-gray-800 text-xl mb-2">회차 관리</h2>
        <p className="text-base text-gray-500">
          현재 최신:{" "}
          {lastSession > 0 ? <span className="font-medium text-gray-700">제{lastSession}회차</span> : <span className="text-gray-400">없음</span>}
          {" / "}다음: <span className="font-bold text-blue-600">제{lastSession + 1}회차</span>
        </p>
      </div>

      {/* Usage Guide */}
      <div className="bg-blue-50 rounded-2xl border border-blue-200 p-6">
        <button onClick={() => setShowGuide(!showGuide)} className="w-full flex items-center justify-between">
          <h3 className="font-bold text-blue-800 text-base">사용 방법 안내</h3>
          <span className="text-blue-500">{showGuide ? "접기" : "펼치기"}</span>
        </button>
        {showGuide && (
          <div className="mt-5 space-y-5">
            <div className="space-y-4">
              {[
                ["1", "Claude에게 퀴즈 생성 요청", "아래 프롬프트를 복사해서 Claude에게 붙여넣으세요."],
                ["2", "생성된 JSON 복사", "Claude가 출력한 JSON 코드 블록을 복사하세요."],
                ["3", "아래 입력창에 붙여넣기 → 검증 → 회차 시작", "미리보기로 확인 후 시작 버튼을 누르면 팀원에게 공개됩니다."],
              ].map(([num, title, desc]) => (
                <div key={num} className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full text-base flex items-center justify-center font-bold">{num}</span>
                  <div>
                    <p className="text-base font-medium text-gray-800">{title}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-blue-700">Claude 퀴즈 생성 프롬프트</span>
                <button onClick={() => copyToClipboard(PROMPT_TEMPLATE.replace(/N회차/g, `${lastSession+1}회차`).replace(/"session": N/, `"session": ${lastSession+1}`), setPromptCopied)}
                  className="text-sm px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
                  {promptCopied ? "복사됨!" : "프롬프트 복사"}
                </button>
              </div>
              <pre className="bg-white rounded-xl p-4 text-sm text-gray-600 overflow-x-auto max-h-48 overflow-y-auto border border-blue-100 whitespace-pre-wrap">
                {PROMPT_TEMPLATE.replace(/N회차/g, `${lastSession+1}회차`).replace(/"session": N/, `"session": ${lastSession+1}`)}
              </pre>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-blue-700">JSON 형식 예시</span>
                <button onClick={() => copyToClipboard(SAMPLE_JSON, setSampleCopied)}
                  className="text-sm px-3 py-1.5 rounded-lg bg-gray-600 text-white hover:bg-gray-700">
                  {sampleCopied ? "복사됨!" : "예시 복사"}
                </button>
              </div>
              <pre className="bg-white rounded-xl p-4 text-sm text-gray-600 overflow-x-auto max-h-48 overflow-y-auto border border-blue-100">{SAMPLE_JSON}</pre>
            </div>
          </div>
        )}
      </div>

      {/* JSON Input */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-bold text-gray-800 text-lg mb-2">퀴즈 JSON 입력</h3>
        <p className="text-sm text-gray-400 mb-4">Claude가 생성한 JSON을 그대로 붙여넣고 "검증 및 미리보기"를 누르세요.</p>
        <textarea
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder={`여기에 JSON을 붙여넣으세요.\n\n{\n  "session": ${lastSession + 1},\n  "date": "${new Date().toISOString().split("T")[0]}",\n  "questions": [...]\n}`}
          className="w-full h-72 p-4 border border-gray-200 rounded-xl text-base font-mono resize-y focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300"
        />
        <button onClick={handleValidate} disabled={!jsonInput.trim()}
          className="mt-4 w-full sm:w-auto px-8 py-3 bg-gray-800 text-white rounded-xl font-medium text-lg hover:bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          검증 및 미리보기
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-5 text-base">{error}</div>}
      {success && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl p-5 text-base font-medium">{success}</div>}

      {/* Preview */}
      {preview && (
        <div className="bg-white rounded-2xl shadow-sm border border-blue-200 p-6 space-y-5">
          <h3 className="font-bold text-blue-700 text-lg">미리보기</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-blue-50 rounded-xl p-4">
              <div className="text-3xl font-bold text-blue-700">{preview.session}</div>
              <div className="text-sm text-gray-500">회차</div>
            </div>
            <div className="bg-blue-50 rounded-xl p-4">
              <div className="text-3xl font-bold text-blue-700">{preview.totalQuestions}</div>
              <div className="text-sm text-gray-500">문항</div>
            </div>
            <div className="bg-blue-50 rounded-xl p-4">
              <div className="text-base font-bold text-blue-700 leading-10">{preview.date}</div>
              <div className="text-sm text-gray-500">날짜</div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-500 mb-2">범주 분포</h4>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(preview.catDist).map(([cat, count]) => (
                  <span key={cat} className="text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded-lg">{cat} {CATEGORIES[cat] || ""}: {count}</span>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-500 mb-2">난이도</h4>
              <div className="flex flex-wrap gap-1.5">
                <span className="text-sm bg-sky-50 text-sky-700 px-3 py-1 rounded-lg">기본: {preview.diffDist.basic || 0}</span>
                <span className="text-sm bg-rose-50 text-rose-700 px-3 py-1 rounded-lg">심화: {preview.diffDist.hard || 0}</span>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-500 mb-2">유형</h4>
              <div className="flex flex-wrap gap-1.5">
                <span className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded-lg">선택형: {preview.typeDist.choice || 0}</span>
                <span className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded-lg">서술형: {preview.typeDist.essay || 0}</span>
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-500 mb-2">문항 목록</h4>
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {preview.questions.map((q) => (
                <div key={q.id} className="text-base py-2 px-4 rounded-xl bg-gray-50 flex items-center gap-3">
                  <span className="flex-shrink-0 text-blue-500 font-mono text-sm w-7">{q.id}</span>
                  <span className="flex-shrink-0 text-sm bg-blue-100 text-blue-600 px-2 py-0.5 rounded-lg">{q.category}</span>
                  <span className="text-gray-600 truncate">{q.question}</span>
                </div>
              ))}
            </div>
          </div>
          <button onClick={handleStart} disabled={loading}
            className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-xl hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {loading ? "저장 중..." : `제${preview.session}회차 시작`}
          </button>
        </div>
      )}
    </div>
  );
}
