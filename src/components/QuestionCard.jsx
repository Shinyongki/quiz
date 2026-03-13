import React, { useState } from "react";

const DIFF_LABEL = { basic: "기본", hard: "심화", expert: "보너스" };
const DIFF_STYLE = {
  basic: "bg-sky-100 text-sky-700",
  hard: "bg-rose-100 text-rose-700",
  expert: "bg-amber-100 text-amber-700",
};
const TYPE_LABEL = { choice: "선택형", essay: "서술형" };

// **텍스트** → 하이라이트 렌더링
function Highlight({ text }) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          const inner = part.slice(2, -2);
          return (
            <mark key={i} className="bg-yellow-200 text-gray-900 rounded px-0.5 font-semibold" style={{ textDecoration: "none" }}>
              {inner}
            </mark>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// 한국어 불용어 (조사·접속사 등)
const STOP_WORDS = new Set([
  "의","가","이","은","는","을","를","에","에서","와","과","도","로","으로",
  "에게","한","할","하는","하고","하여","된","되는","되어","있는","없는",
  "것","수","등","및","또는","그","이","저","때","중","후","위","간",
  "대한","통해","따라","위한","있다","없다","한다","된다","있음","없음",
  "경우","해당","필요","가능","불가","대상","기준","사항","내용","관련",
]);

// 모범 답안에서 핵심 키포인트 추출
function extractKeyPoints(answer) {
  // 문장 단위로 분리 (마침표, 세미콜론, 줄바꿈)
  const sentences = answer
    .split(/[.;·\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);

  // 각 문장에서 핵심 키워드 추출
  const points = sentences.map((sentence) => {
    const words = sentence
      .replace(/[()""''「」『』\[\]{}]/g, "")
      .split(/[\s,·→/]+/)
      .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
    return { text: sentence, keywords: words };
  });

  return points;
}

// 사용자 답안과 모범답안 키포인트 비교 (관대한 참고용 채점)
function gradeEssay(userAnswer, modelAnswer) {
  if (!userAnswer.trim()) return null;

  const keyPoints = extractKeyPoints(modelAnswer);
  const userText = userAnswer.toLowerCase();

  const results = keyPoints.map((point) => {
    // 키워드 중 몇 개가 사용자 답안에 포함되는지
    const matched = point.keywords.filter((kw) =>
      userText.includes(kw.toLowerCase())
    );
    const coverage = point.keywords.length > 0
      ? matched.length / point.keywords.length
      : 0;
    return {
      text: point.text,
      keywords: point.keywords,
      matched,
      missed: point.keywords.filter((kw) => !userText.includes(kw.toLowerCase())),
      coverage,
      // 관대한 기준: 키워드 1개라도 포함되면 "언급됨"
      status: coverage >= 0.3 ? "match" : coverage > 0 ? "partial" : "miss",
    };
  });

  const totalPoints = results.length;
  const matchedPoints = results.filter((r) => r.status === "match").length;
  const partialPoints = results.filter((r) => r.status === "partial").length;
  // 언급된 포인트만 카운트 (미언급은 감점하지 않음)
  const coveredPoints = matchedPoints + partialPoints;
  const score = totalPoints > 0
    ? Math.min(100, Math.round((coveredPoints / totalPoints) * 100))
    : 0;

  return { results, score, totalPoints, matchedPoints, partialPoints };
}

export default function QuestionCard({
  q,
  index,
  revealed,
  bookmarked,
  onReveal,
  onAnswer,
  onBookmark,
  readOnly,
}) {
  const [showAnswer, setShowAnswer] = useState(revealed && !readOnly);
  const [selectedOption, setSelectedOption] = useState(null);
  const [essayInput, setEssayInput] = useState("");
  const [gradeResult, setGradeResult] = useState(null);
  const isRevealed = readOnly ? showAnswer : revealed || showAnswer;

  const correctMark = q.answer ? q.answer.match(/^[①②③④]/)?.[0] : null;
  const isCorrect = selectedOption !== null && correctMark
    ? q.options?.[selectedOption]?.startsWith(correctMark)
    : null;

  const handleReveal = () => {
    setShowAnswer(true);
    if (q.type === "essay" && essayInput.trim()) {
      setGradeResult(gradeEssay(essayInput, q.answer));
    }
    if (onReveal) onReveal(q.id);

    // 선택형 오답 시 자동 북마크
    if (q.type === "choice" && selectedOption !== null && correctMark) {
      const isWrong = !q.options?.[selectedOption]?.startsWith(correctMark);
      if (isWrong && onBookmark && !bookmarked) {
        onBookmark(q);
      }
    }
  };

  const handleToggle = () => {
    setShowAnswer(!showAnswer);
  };

  const STATUS_ICON = { match: "text-emerald-500", partial: "text-amber-500", miss: "text-gray-400" };
  const STATUS_BG = { match: "bg-emerald-50", partial: "bg-amber-50", miss: "bg-gray-50" };
  const STATUS_TEXT = { match: "언급됨", partial: "부분 언급", miss: "추가 학습 참고" };

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden flex flex-col ring-1 ring-gray-100">
      {/* Header tags */}
      <div className="flex flex-wrap gap-1.5 px-4 pt-3 pb-1.5">
        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-700">
          {q.categoryName || q.category}
        </span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${DIFF_STYLE[q.difficulty] || "bg-gray-100 text-gray-600"}`}>
          {DIFF_LABEL[q.difficulty] || q.difficulty}
        </span>
        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-600">
          {TYPE_LABEL[q.type] || q.type}
        </span>
        {q.perspectiveTag && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-teal-100 text-teal-700">
            {q.perspectiveTag}
          </span>
        )}
        {q.sessionNumber && (
          <span className="text-xs px-2 py-0.5 rounded bg-purple-50 text-purple-600">
            {q.sessionNumber}회차
          </span>
        )}
      </div>

      {/* Question */}
      <div className="px-4 pb-3 flex-1">
        <p className="font-medium text-gray-800 text-sm leading-relaxed">
          <span className="text-blue-500 font-bold mr-0.5">Q{index != null ? index + 1 : ""}.</span>
          {q.question}
        </p>

        {/* Options (선택형) */}
        {q.type === "choice" && q.options && (
          <div className="mt-2 space-y-1">
            {q.options.map((opt, i) => {
              const isSelected = selectedOption === i;
              const optMark = opt.match(/^[①②③④]/)?.[0];
              const isThisCorrect = correctMark && optMark === correctMark;

              let optionStyle = "bg-gray-50 text-gray-700 border-transparent hover:bg-blue-50 hover:border-blue-200 cursor-pointer";
              if (isRevealed && isSelected && isThisCorrect) {
                optionStyle = "bg-emerald-50 text-emerald-800 border-emerald-400";
              } else if (isRevealed && isSelected && !isThisCorrect) {
                optionStyle = "bg-red-50 text-red-800 border-red-400";
              } else if (isRevealed && isThisCorrect) {
                optionStyle = "bg-emerald-50 text-emerald-700 border-emerald-300";
              } else if (isSelected && !isRevealed) {
                optionStyle = "bg-blue-50 text-blue-800 border-blue-400";
              }

              return (
                <button
                  key={i}
                  onClick={() => { if (!isRevealed) { setSelectedOption(i); if (onAnswer) onAnswer(q.id); } }}
                  disabled={readOnly && !isRevealed}
                  className={`w-full text-left py-1.5 px-3 rounded-lg text-sm border-2 transition-all ${optionStyle}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        )}

        {/* 서술형 답안 입력 */}
        {q.type === "essay" && !readOnly && !isRevealed && (
          <div className="mt-3">
            <textarea
              value={essayInput}
              onChange={(e) => { setEssayInput(e.target.value); if (e.target.value.trim() && onAnswer) onAnswer(q.id); }}
              placeholder="나의 답안을 작성하세요..."
              className="w-full h-28 p-3 border border-gray-200 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300"
            />
            {essayInput.trim() && (
              <p className="text-xs text-gray-400 mt-1">정답 보기를 누르면 자동 채점됩니다</p>
            )}
          </div>
        )}
      </div>

      {/* Answer area */}
      {!isRevealed ? (
        <div className="px-4 pb-3">
          {q.type === "choice" && selectedOption !== null && !readOnly && (
            <p className="text-xs text-blue-500 mb-1.5 font-medium">
              {q.options[selectedOption]?.match(/^[①②③④]/)?.[0]} 선택됨
            </p>
          )}
          <button
            onClick={readOnly ? handleToggle : handleReveal}
            className={`w-full py-2 rounded-lg font-medium text-sm transition-colors ${
              readOnly
                ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            정답 보기
          </button>
        </div>
      ) : (
        <div className="border-t border-blue-100 bg-blue-50/30 px-4 py-3">
          {/* 선택형 정오답 */}
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-semibold text-blue-600">정답</span>
            {!readOnly && q.type === "choice" && selectedOption !== null && (
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                isCorrect ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
              }`}>
                {isCorrect ? "O" : "X"}
              </span>
            )}
            {!readOnly && q.type === "essay" && gradeResult && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-600">
                핵심 포인트 {gradeResult.matchedPoints + gradeResult.partialPoints}/{gradeResult.totalPoints} 언급
              </span>
            )}
          </div>
          <p className="text-sm text-gray-800 font-medium mb-2"><Highlight text={q.answer} /></p>

          {/* 서술형 채점 결과 */}
          {!readOnly && q.type === "essay" && gradeResult && (
            <div className="mb-3">
              <span className="text-xs font-semibold text-indigo-600">채점 결과</span>
              {/* 내 답안 */}
              <div className="mt-1 bg-white rounded-lg px-3 py-2 border border-gray-200 mb-2">
                <p className="text-xs text-gray-400 mb-1">내 답안</p>
                <p className="text-sm text-gray-700 leading-relaxed">{essayInput}</p>
              </div>
              {/* 핵심 포인트 분석 */}
              <div className="space-y-1.5">
                {gradeResult.results.map((r, ri) => (
                  <div key={ri} className={`rounded-lg px-3 py-2 ${STATUS_BG[r.status]}`}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`text-xs font-bold ${STATUS_ICON[r.status]}`}>
                        {r.status === "match" ? "O" : r.status === "partial" ? "△" : "—"}
                      </span>
                      <span className="text-xs font-medium text-gray-500">{STATUS_TEXT[r.status]}</span>
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed">{r.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!readOnly && q.type === "essay" && !gradeResult && essayInput.trim() === "" && (
            <div className="mb-2 py-1.5 px-3 rounded-lg text-xs font-medium bg-gray-100 text-gray-500">
              답안을 작성하지 않고 정답을 확인했습니다
            </div>
          )}

          {q.basis && (
            <div className="mb-2">
              <span className="text-xs font-semibold text-blue-600">근거</span>
              <div className="mt-1 bg-white rounded-lg pl-3 pr-2 py-2" style={{ borderLeft: "3px solid #93c5fd" }}>
                <p className="text-sm text-gray-700 leading-relaxed"><Highlight text={q.basis} /></p>
                {q.page && (
                  <p className="text-xs text-gray-400 mt-1">— 사업안내 {q.page}</p>
                )}
              </div>
            </div>
          )}
          {!q.basis && q.page && (
            <p className="text-xs text-gray-400 mb-1">— 사업안내 {q.page}</p>
          )}

          {/* 보충 설명 (note) */}
          {q.note && (
            <div className="mb-2">
              <span className="text-xs font-semibold text-amber-600">참고</span>
              <div className="mt-1 bg-amber-50 rounded-lg px-3 py-2" style={{ borderLeft: "3px solid #fbbf24" }}>
                <p className="text-sm text-gray-700 leading-relaxed"><Highlight text={q.note} /></p>
              </div>
            </div>
          )}

          {/* expert 출제 조건 (expertConditions) */}
          {q.expertConditions && q.expertConditions.length > 0 && (
            <div className="mb-2">
              <span className="text-xs font-semibold text-amber-600">출제 조건</span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {q.expertConditions.map((cond, ci) => (
                  <span key={ci} className="text-xs px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                    {cond}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 상세 해설 (explanation) */}
          {q.explanation && (
            <div className="mb-2">
              <span className="text-xs font-semibold text-emerald-600">상세 해설</span>
              <div className="mt-1 bg-emerald-50 rounded-lg px-3 py-2" style={{ borderLeft: "3px solid #34d399" }}>
                <p className="text-sm text-gray-700 leading-relaxed"><Highlight text={q.explanation} /></p>
              </div>
            </div>
          )}

          {/* 핵심 개념 (concepts) */}
          {q.concepts && q.concepts.length > 0 && (
            <div className="mb-2">
              <span className="text-xs font-semibold text-indigo-600">핵심 개념</span>
              <div className="mt-1 grid gap-1.5">
                {q.concepts.map((concept, ci) => (
                  <div key={ci} className="bg-indigo-50 rounded-lg px-3 py-2 border border-indigo-100">
                    <p className="text-sm text-gray-700 leading-relaxed">{concept}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 관련 규정 비교 (related) */}
          {q.related && q.related.length > 0 && (
            <div className="mb-2">
              <span className="text-xs font-semibold text-violet-600">관련 규정 비교</span>
              <div className="mt-1 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(q.related.length, 3)}, 1fr)` }}>
                {q.related.map((r, ri) => (
                  <div key={ri} className={`rounded-lg px-3 py-2 ${
                    r.highlight ? "bg-violet-50 border border-violet-200" : "bg-gray-50 border border-gray-150"
                  }`}>
                    <p className={`text-xs font-semibold mb-1.5 ${r.highlight ? "text-violet-700" : "text-gray-600"}`}>
                      {r.title}
                    </p>
                    <ul className="space-y-0.5">
                      {r.items.map((item, ii) => (
                        <li key={ii} className="text-xs text-gray-700 flex gap-1">
                          <span className="text-gray-400">·</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 mt-2">
            {readOnly && (
              <button onClick={handleToggle} className="text-xs text-gray-400 hover:text-gray-600">
                정답 숨기기
              </button>
            )}
            {onBookmark && !readOnly && (
              bookmarked ? (
                <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-3 py-1 rounded-lg">
                  {isCorrect === false ? "오답 자동 저장됨" : "저장됨"}
                </span>
              ) : (
                <button
                  onClick={() => onBookmark(q)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 font-medium transition-colors"
                >
                  다시 보기 저장
                </button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
