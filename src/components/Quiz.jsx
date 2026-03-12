import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import QuestionCard from "./QuestionCard";

export default function Quiz() {
  const { memberName } = useParams();
  const name = decodeURIComponent(memberName);
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [sessionDocId, setSessionDocId] = useState(null);
  const [revealedIds, setRevealedIds] = useState(new Set());
  const [answeredIds, setAnsweredIds] = useState(new Set());
  const [bookmarkedIds, setBookmarkedIds] = useState(new Set());
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, "quiz_sessions"),
      orderBy("session", "desc"),
      limit(1)
    );
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const docSnap = snap.docs[0];
        setSession(docSnap.data());
        setSessionDocId(docSnap.id);
        if (docSnap.data().progress?.[name] === "completed") {
          setCompleted(true);
        }
      }
    });
    return unsub;
  }, [name]);

  useEffect(() => {
    if (!session) return;
    const q = query(
      collection(db, "quiz_bookmarks"),
      where("sessionId", "==", session.session)
    );
    getDocs(q).then((snap) => {
      const ids = new Set();
      snap.forEach((d) => {
        const data = d.data();
        if (!data.memberName || data.memberName === name) {
          ids.add(data.questionId);
        }
      });
      setBookmarkedIds(ids);
    });
  }, [session, name]);

  const questions = session?.questions || [];
  const mainQuestions = questions.filter((q) => q.difficulty !== "expert");
  const expertQuestions = questions.filter((q) => q.difficulty === "expert");
  const total = questions.length;
  // 진행률 = 답안 선택 OR 정답 보기 중 하나라도 한 문항
  const doneIds = new Set([...revealedIds, ...answeredIds]);
  const doneCount = doneIds.size;

  const checkCompletion = useCallback(async (nextDone) => {
    if (nextDone.size === total && !completed) {
      setCompleted(true);
      if (sessionDocId) {
        await updateDoc(doc(db, "quiz_sessions", sessionDocId), {
          [`progress.${name}`]: "completed",
        });
      }
    }
  }, [total, completed, sessionDocId, name]);

  const handleReveal = async (qId) => {
    const nextRevealed = new Set(revealedIds);
    nextRevealed.add(qId);
    setRevealedIds(nextRevealed);

    const nextDone = new Set([...nextRevealed, ...answeredIds]);
    await checkCompletion(nextDone);
  };

  const handleAnswer = async (qId) => {
    if (answeredIds.has(qId)) return;
    const nextAnswered = new Set(answeredIds);
    nextAnswered.add(qId);
    setAnsweredIds(nextAnswered);

    const nextDone = new Set([...revealedIds, ...nextAnswered]);
    await checkCompletion(nextDone);
  };

  const handleBookmark = async (q) => {
    if (bookmarkedIds.has(q.id)) return;
    await addDoc(collection(db, "quiz_bookmarks"), {
      sessionId: session.session,
      memberName: name,
      questionId: q.id,
      category: q.category,
      categoryName: q.categoryName,
      difficulty: q.difficulty,
      type: q.type,
      question: q.question,
      options: q.options || null,
      answer: q.answer,
      basis: q.basis || "",
      page: q.page || "",
      note: q.note || "",
      related: q.related || null,
      perspectiveTag: q.perspectiveTag || null,
      explanation: q.explanation || null,
      concepts: q.concepts || null,
      savedAt: serverTimestamp(),
    });
    setBookmarkedIds(new Set(bookmarkedIds).add(q.id));
  };

  if (!session) {
    return (
      <div className="text-center py-20 text-gray-500 text-lg">로딩 중...</div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-sm text-gray-400">
              제{session.session}회차 · {session.date}
            </span>
            <h2 className="text-xl font-bold text-gray-800">{name}</h2>
          </div>
          <button
            onClick={() => navigate("/")}
            className="text-base text-gray-500 hover:text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-100"
          >
            홈으로
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-4">
          <div className="flex-1 bg-gray-100 rounded-full h-3.5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 bg-blue-500"
              style={{
                width: `${total > 0 ? (doneCount / total) * 100 : 0}%`,
              }}
            />
          </div>
          <span className="text-base font-medium text-gray-500 whitespace-nowrap">
            {doneCount}/{total}
          </span>
        </div>

        {completed && (
          <div className="mt-4 text-center py-3 bg-emerald-50 rounded-xl">
            <span className="text-emerald-700 font-semibold text-base">
              모든 문항 확인 완료!
            </span>
          </div>
        )}
      </div>

      {/* Main Questions - 2열 그리드 (PC), 1열 (모바일) */}
      {mainQuestions.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {mainQuestions.map((q, i) => (
            <QuestionCard
              key={q.id}
              q={q}
              index={i}
              revealed={revealedIds.has(q.id)}
              bookmarked={bookmarkedIds.has(q.id)}
              onReveal={handleReveal}
              onAnswer={handleAnswer}
              onBookmark={handleBookmark}
            />
          ))}
        </div>
      )}

      {/* Expert (보너스) Questions */}
      {expertQuestions.length > 0 && (
        <>
          <div className="mt-8 mb-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-amber-200" />
            <span className="text-base font-bold text-amber-600 px-4 py-1.5 bg-amber-50 rounded-full border border-amber-200">
              보너스 문제 ({expertQuestions.length}문항)
            </span>
            <div className="h-px flex-1 bg-amber-200" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {expertQuestions.map((q, i) => (
              <QuestionCard
                key={q.id}
                q={q}
                index={mainQuestions.length + i}
                revealed={revealedIds.has(q.id)}
                bookmarked={bookmarkedIds.has(q.id)}
                onReveal={handleReveal}
                onAnswer={handleAnswer}
                onBookmark={handleBookmark}
              />
            ))}
          </div>
        </>
      )}

      {/* Bottom nav */}
      <div className="mt-8 text-center">
        <button
          onClick={() => navigate("/dashboard")}
          className="text-base text-blue-600 hover:text-blue-800 font-medium"
        >
          진행현황으로 이동 →
        </button>
      </div>
    </div>
  );
}
