import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { db } from "../firebase";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  doc,
  updateDoc,
} from "firebase/firestore";
import { MEMBERS } from "../config/members";

const STATUS_LABEL = {
  not_started: "미시작",
  in_progress: "진행 중",
  completed: "완료",
};

const STATUS_COLOR = {
  not_started: { bg: "bg-gray-100", border: "border-gray-200", badge: "bg-gray-200 text-gray-600", avatar: "bg-gray-400" },
  in_progress: { bg: "bg-amber-50", border: "border-amber-200", badge: "bg-amber-100 text-amber-700", avatar: "bg-amber-500" },
  completed: { bg: "bg-emerald-50", border: "border-emerald-200", badge: "bg-emerald-100 text-emerald-700", avatar: "bg-emerald-500" },
};

export default function Home() {
  const [currentSession, setCurrentSession] = useState(null);
  const [sessionDocId, setSessionDocId] = useState(null);
  const [confirmMember, setConfirmMember] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const q = query(
      collection(db, "quiz_sessions"),
      orderBy("session", "desc"),
      limit(1)
    );
    const unsub = onSnapshot(q, (snap) => {
      setInitialLoading(false);
      if (!snap.empty) {
        const docSnap = snap.docs[0];
        setCurrentSession(docSnap.data());
        setSessionDocId(docSnap.id);
      } else {
        setCurrentSession(null);
        setSessionDocId(null);
      }
    });
    return unsub;
  }, []);

  const handleStart = async (name) => {
    if (!sessionDocId) return;
    const status = currentSession?.progress?.[name];
    if (status === "completed") {
      navigate(`/quiz/${encodeURIComponent(name)}`);
      return;
    }
    if (status !== "in_progress") {
      await updateDoc(doc(db, "quiz_sessions", sessionDocId), {
        [`progress.${name}`]: "in_progress",
      });
    }
    navigate(`/quiz/${encodeURIComponent(name)}`);
  };

  if (initialLoading) {
    return (
      <div className="text-center py-20">
        <div className="text-gray-400">로딩 중...</div>
      </div>
    );
  }

  if (!currentSession) {
    return (
      <div className="text-center py-20">
        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h2 className="text-2xl font-semibold text-gray-700 mb-3">
          등록된 회차가 없습니다
        </h2>
        <p className="text-gray-500 text-lg mb-8">
          관리자 화면에서 새 회차를 시작해주세요.
        </p>
        <Link
          to="/admin"
          className="inline-block px-8 py-3 bg-blue-600 text-white text-lg rounded-xl font-medium hover:bg-blue-700 transition-colors"
        >
          관리자 화면으로 이동
        </Link>
      </div>
    );
  }

  const completedCount = MEMBERS.filter(
    (name) => currentSession.progress?.[name] === "completed"
  ).length;

  return (
    <div>
      {/* Session info */}
      <div className="bg-white rounded-2xl shadow-sm border border-blue-100 p-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <span className="inline-block bg-blue-100 text-blue-700 text-base font-semibold px-4 py-1.5 rounded-full">
              제{currentSession.session}회차
            </span>
            <p className="text-gray-500 mt-2">{currentSession.date}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-blue-600">
              {currentSession.questions?.length || 0}
              <span className="text-base font-normal text-gray-400 ml-1">문항</span>
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {completedCount}/{MEMBERS.length}명 완료
            </p>
          </div>
        </div>
      </div>

      {/* Member grid */}
      <h3 className="text-base font-semibold text-gray-500 mb-4">
        이름을 눌러 퀴즈를 시작하세요
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {MEMBERS.map((name) => {
          const status = currentSession.progress?.[name] || "not_started";
          const colors = STATUS_COLOR[status];
          return (
            <button
              key={name}
              onClick={() => setConfirmMember(name)}
              className={`flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all hover:shadow-lg active:scale-[0.97] ${colors.bg} ${colors.border}`}
            >
              <div className={`w-16 h-16 rounded-full text-white flex items-center justify-center font-bold text-2xl ${colors.avatar}`}>
                {name[0]}
              </div>
              <span className="font-semibold text-gray-800 text-lg">{name}</span>
              <span className={`text-sm font-semibold px-4 py-1 rounded-full ${colors.badge}`}>
                {STATUS_LABEL[status]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Confirm modal */}
      {confirmMember && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-800 mb-3">
              {currentSession.progress?.[confirmMember] === "completed"
                ? "퀴즈 다시 보기"
                : currentSession.progress?.[confirmMember] === "in_progress"
                  ? "퀴즈 이어하기"
                  : "퀴즈 시작 확인"}
            </h3>
            <p className="text-gray-600 text-lg mb-8">
              제{currentSession.session}회차를{" "}
              <span className="font-bold text-blue-600">{confirmMember}</span>
              (으)로{" "}
              {currentSession.progress?.[confirmMember] === "completed"
                ? "다시 봅니다."
                : currentSession.progress?.[confirmMember] === "in_progress"
                  ? "이어서 진행합니다."
                  : "시작합니다."}
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setConfirmMember(null)}
                className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-600 font-medium text-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={() => {
                  handleStart(confirmMember);
                  setConfirmMember(null);
                }}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-medium text-lg hover:bg-blue-700"
              >
                {currentSession.progress?.[confirmMember] === "completed"
                  ? "확인"
                  : "시작"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
