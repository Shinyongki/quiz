# 노인맞춤돌봄서비스 팀 퀴즈 앱

## 프로젝트 개요

2026년 노인맞춤돌봄서비스 사업안내 기반 팀 학습 퀴즈 시스템.  
5명의 팀원이 내부 네트워크에서 함께 사용하는 학습 관리 앱.  
개인 역량 평가가 아닌 **팀 공동 학습**이 목적.

---

## 기술 스택

- **Frontend**: React + Tailwind CSS
- **Database**: Firebase Firestore (실시간 공유 + 영구 누적)
- **실행**: `npm start` → 로컬 개발 서버 → 내부망 접속

---

## Firebase 설정

```javascript
// src/firebase.js
const firebaseConfig = {
  apiKey: "AIzaSyAxMbaKju5hw_HTx10F2Xo5aTpxib5ijww",
  authDomain: "gen-lang-client-0164240497.firebaseapp.com",
  projectId: "gen-lang-client-0164240497",
  storageBucket: "gen-lang-client-0164240497.firebasestorage.app",
  messagingSenderId: "919927408531",
  appId: "1:919927408531:web:d9b50f65fcf1cd6335ca66"
};
```

> 기존 Firestore 컬렉션(codeTasks, knowledge, nomaBasePromptSections 등)에  
> 절대 접근하거나 수정하지 말 것. `quiz_` 접두사 컬렉션만 사용.

---

## Firestore 컬렉션 구조

```
quiz_sessions
  └── {sessionId}
        ├── session: 1
        ├── date: "2026-03-11"
        ├── questions: [ ]        ← 해당 회차 문제 전체 배열 영구 저장
        └── progress
              ├── 홍길동: "not_started" | "in_progress" | "completed"
              ├── 김철수: "completed"
              ├── 이영희: "in_progress"
              ├── 박민준: "not_started"
              └── 최수진: "not_started"

quiz_bookmarks
  └── {bookmarkId}
        ├── sessionId: 1
        ├── questionId: "q1"
        ├── category: "D"               ← 범주별 자동 분류 기준
        ├── categoryName: "재사정·심의"
        ├── difficulty: "basic" | "hard"
        ├── type: "choice" | "essay"
        ├── question: "문제 내용"
        ├── options: [ ]                ← 선택형만 해당
        ├── answer: "정답 내용"
        ├── basis: "근거 내용"
        ├── page: "p.56"
        └── savedAt: timestamp
```

---

## 파일 구조

```
/
├── public/
├── src/
│   ├── components/
│   │   ├── Home.jsx            ← 홈 화면 (팀원 상태 + 이름 선택)
│   │   ├── Quiz.jsx            ← 퀴즈 진행 화면
│   │   ├── Dashboard.jsx       ← 진행 현황 + 저장 문제함 + 전체 문제
│   │   ├── Admin.jsx           ← 관리자 화면 (회차 JSON 입력)
│   │   └── QuestionCard.jsx    ← 문항 카드 컴포넌트
│   ├── config/
│   │   └── members.js          ← 팀원 이름 설정
│   ├── firebase.js             ← Firebase 초기화
│   ├── App.jsx
│   └── index.js
├── CLAUDE.md
└── package.json
```

> `src/data/currentQuiz.json` 파일 없음.  
> 문제 데이터는 앱 내 관리자 화면(Admin)에서 JSON 붙여넣기 → Firebase 저장.  
> 로컬 파일로 문제를 관리하지 않음.

---

## 팀원 설정

```javascript
// src/config/members.js
export const MEMBERS = [
  "홍길동",
  "김철수",
  "이영희",
  "박민준",
  "최수진"
];
```

팀원 이름 변경 시 이 파일만 수정.

---

## 화면 구성 (4개)

### 1. 홈 화면 (Home)
- 현재 활성 회차 번호 + 날짜 표시 (Firebase에서 읽음)
- 팀원 5명 진행 상태 카드
  - 미시작 / 진행 중 / 완료 실시간 반영
  - 이름 카드 클릭 → "N회차를 [이름]으로 시작합니다" 확인 팝업
  - 확인 시 퀴즈 진행 화면으로 이동 + Firebase progress 업데이트
- 상단 네비게이션: [홈] [진행현황] [관리자]

### 2. 퀴즈 진행 화면 (Quiz)
- Firebase에서 현재 회차 문제 로드
- 진행 상태 바 (정답 확인한 문항 수 / 전체 문항 수)
- 각 문항 카드:
  - 범주 태그 + 난이도(기본/어려움) + 유형(선택형/서술형)
  - 문제 내용
  - 선택형: 선택지 ①②③④ 표시
  - [정답 보기] 버튼 → 클릭 시 정답 + 근거 + 페이지 번호 표시
  - 정답 확인 후에만 [다시 보기 저장] 버튼 활성화
  - 저장 시 Firebase quiz_bookmarks에 저장 (저장 주체 이름 비공개)
- 모든 문항 정답 확인 완료 → Firebase progress "completed" 업데이트 → 완료 처리
- [진행현황으로 돌아가기] 버튼

### 3. 진행 현황 + 저장 문제함 (Dashboard)
3개 탭으로 구성:

**[진행 현황 탭]**
- 현재 회차 팀원별 진행 상태 (이름 + 미시작/진행중/완료)
- 회차 이력 목록 (회차 번호 + 날짜)
- 팀 저장 문항 범주별 분포 막대 차트
  → 어떤 범주가 많이 저장됐는지 시각화
  → 다음 회차 Claude 출제 요청 시 참고

**[저장 문제함 탭]**
- Firebase quiz_bookmarks 전체 표시
- 범주 필터 버튼 (전체 / A / B / C / D / E / F / G / H)
- 회차 필터 (전체 / 특정 회차 선택)
- 각 문항 카드:
  - 범주 태그 + 난이도 + 저장된 회차
  - 문제 내용
  - [정답 보기] 토글 → 정답 + 근거 + 페이지
  - 저장 주체 이름 비공개
  - 저장 수 비공개

**[전체 문제 탭]**
- Firebase quiz_sessions에 저장된 모든 회차 문제 전체 조회
- 회차별 / 범주별 필터
- 각 문항 카드: 문제 + 정답 + 근거 표시

### 4. 관리자 화면 (Admin)
- 현재 활성 회차 정보 표시
- JSON 텍스트 입력창 (Claude가 생성한 퀴즈 JSON 붙여넣기)
- JSON 유효성 검사 + 미리보기 (문항 수, 범주 분포 확인)
- [회차 시작] 버튼 클릭 시:
  - 입력된 JSON을 Firebase quiz_sessions에 저장
  - 팀원 전체 진행 상태 "not_started"로 초기화
  - 홈 화면에 새 회차 즉시 반영 (실시간)
- 회차 번호 자동 증가 (이전 최대 회차 + 1)

---

## 회차 운영 방법

### 매 회차 진행 순서

```
1. Claude에게 퀴즈 JSON 생성 요청
         ↓
2. 생성된 JSON을 앱 관리자 화면(Admin)에 붙여넣기
         ↓
3. [회차 시작] 버튼 클릭
         ↓
4. Firebase quiz_sessions에 자동 저장
   + 팀원 진행 상태 초기화
         ↓
5. 팀원 각자 홈 화면에서 이름 클릭 → 퀴즈 진행
         ↓
6. 다시 보고 싶은 문항 저장
   → Firebase quiz_bookmarks 실시간 반영
         ↓
7. 진행 현황 탭에서 팀 전체 상태 + 범주 분포 확인
         ↓
8. 저장 문제함 탭에서 누적 복습 문항 학습
```

### Claude 퀴즈 생성 요청 프롬프트

```
2026 노인맞춤돌봄서비스 사업안내 기반으로
N회차 퀴즈 JSON을 아래 형식으로 생성해줘.

구성:
- 기본 문제(선택형) 5문항: 범주 A~H 혼합
- 어려운 문제(선택형) 3문항: 조건 분기·변경사항·예외규정 중심
- 어려운 문제(서술형) 2문항: 실무 사례형

이전 회차 저장 문항 범주 분포: (Dashboard 차트 확인 후 입력)
이번 회차 집중 범주: (없으면 자동 혼합)

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
      "basis": "근거 내용",
      "page": "p.6"
    },
    {
      "id": "q9",
      "category": "A",
      "categoryName": "서비스 대상·자격",
      "difficulty": "hard",
      "type": "essay",
      "question": "서술형 문제 내용",
      "answer": "모범 답안 내용",
      "basis": "근거 내용",
      "page": "p.43"
    }
  ]
}
```

---

## 범주 코드

| 코드 | 범주명 |
|------|--------|
| A | 서비스 대상·자격 |
| B | 서비스 시간·내용 |
| C | 인력·급여·근무 |
| D | 재사정·심의 |
| E | 종결·사후관리 |
| F | 퇴원환자 단기집중 |
| G | 특화지원 |
| H | 2025→2026 변경사항 |

---

## 핵심 비즈니스 규칙

### 진행 상태
| 상태 | 조건 | 팀 공개 여부 |
|------|------|-------------|
| 미시작 | 홈 화면 이름 클릭 전 | 공개 (이름 표시) |
| 진행 중 | 이름 클릭 후 ~ 전체 정답 확인 전 | 공개 (이름 표시) |
| 완료 | 모든 문항 정답 보기 완료 | 공개 (이름 표시) |

### 저장 문항 공개 범위
| 항목 | 공개 여부 |
|------|----------|
| 저장된 문항 내용 (문제·정답·근거) | 팀 전체 공개 |
| 저장 주체 이름 | 비공개 |
| 저장 수 | 비공개 |

### 완료 조건
- 모든 문항의 [정답 보기]를 클릭해야 완료 처리
- 정답을 보지 않은 문항이 하나라도 있으면 완료 불가

### 데이터 누적 원칙
- 모든 회차 문제는 Firebase quiz_sessions에 영구 보관
- 저장 문항은 Firebase quiz_bookmarks에 영구 누적
- 로컬 파일로 문제를 관리하지 않음
- 회차 삭제 기능 없음 (누적 전용)

---

## 실행 방법

```bash
npm install
npm start
# → http://localhost:3000
# → 내부망: http://{서버IP}:3000
```

---

## 향후 확장 계획

- 새 매뉴얼 추가: 프로젝트 지식에 PDF 업로드 → Claude에게 JSON 생성 요청 → Admin 화면에서 입력
- 팀원 변경: src/config/members.js 수정
- 심화 출제: Dashboard 범주 분포 차트 확인 → Claude 퀴즈 생성 요청 시 취약 범주 반영
- 누적 분석: quiz_sessions + quiz_bookmarks 데이터 기반 자동 집계 고도화
