export function GraduationTable() {
  return (
    <div className="bg-white rounded-3xl p-8 shadow-sm">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          AI빅데이터융합경영학과 · 졸업 이수학점 요건
        </h2>
      </div>

      <div className="border-2 border-slate-400 rounded-2xl overflow-hidden">
        {/* 헤더 */}
        <div className="grid grid-cols-[160px_120px_1fr_120px_220px] bg-blue-50">
          <div className="border-r-2 border-slate-400 p-4 flex items-center justify-center">
            <span className="font-bold text-gray-900">이수구분</span>
          </div>
          <div className="border-r-2 border-slate-400 p-4 flex items-center justify-center">
            <span className="font-bold text-gray-900 text-sm">최저이수학점</span>
          </div>
          <div className="border-r-2 border-slate-400 p-4 flex items-center justify-center">
            <span className="font-bold text-gray-900">교과목명(영역)</span>
          </div>
          <div className="border-r-2 border-slate-400 p-4 flex items-center justify-center">
            <span className="font-bold text-gray-900">학점</span>
          </div>
          <div className="p-4 flex items-center justify-center">
            <span className="font-bold text-gray-900">비고</span>
          </div>
        </div>

        {/* 기초교양 */}
        <div className="grid grid-cols-[160px_120px_1fr_120px_220px] bg-white border-t-2 border-slate-400">
          <div className="border-r-2 border-slate-400 p-4 flex items-center justify-center">
            <span className="font-bold text-gray-900">기초교양</span>
          </div>
          <div className="border-r-2 border-slate-400 p-4 flex items-center justify-center">
            <span className="font-bold text-gray-900 text-2xl">7</span>
          </div>
          <div className="border-r-2 border-slate-400 p-4 flex items-center">
            <div className="space-y-2">
              <p className="text-gray-900 font-semibold">글쓰기</p>
              <p className="text-gray-900 font-semibold">College English I, II</p>
              <p className="text-gray-900 font-semibold">English Conversation I, II</p>
            </div>
          </div>
          <div className="border-r-2 border-slate-400 p-4 flex items-center">
            <div className="space-y-2 text-center w-full">
              <p className="font-bold text-gray-900">3</p>
              <p className="font-bold text-gray-900">2</p>
              <p className="font-bold text-gray-900">2</p>
            </div>
          </div>
          <div className="p-4 flex items-center">
            <div className="space-y-2">
              <p className="text-gray-900 font-semibold">필수</p>
              <p className="text-gray-900 font-semibold">필수 · 택1</p>
              <p className="text-gray-900 font-semibold">필수 · 택1</p>
            </div>
          </div>
        </div>

        {/* 핵심교양 */}
        <div className="grid grid-cols-[160px_120px_1fr_120px_220px] bg-white border-t-2 border-slate-400">
          <div className="border-r-2 border-slate-400 p-4 flex items-center justify-center">
            <span className="font-bold text-gray-900">핵심교양</span>
          </div>
          <div className="border-r-2 border-slate-400 p-4 flex items-center justify-center">
            <span className="font-bold text-gray-900 text-2xl">15</span>
          </div>
          <div className="border-r-2 border-slate-400 p-4 flex items-center">
            <div className="space-y-2">
              <p className="text-gray-900 font-semibold">인문 I</p>
              <p className="text-gray-900 font-semibold">인문 II</p>
              <p className="text-gray-900 font-semibold">소통</p>
              <p className="text-gray-900 font-semibold">글로벌</p>
              <p className="text-gray-900 font-semibold">창의</p>
            </div>
          </div>
          <div className="border-r-2 border-slate-400 p-4 flex items-center">
            <div className="space-y-2 text-center w-full">
              <p className="font-bold text-gray-900">3</p>
              <p className="font-bold text-gray-900">3</p>
              <p className="font-bold text-gray-900">3</p>
              <p className="font-bold text-gray-900">3</p>
              <p className="font-bold text-gray-900">3</p>
            </div>
          </div>
          <div className="p-4 flex items-center justify-center">
            <span className="text-gray-900 font-semibold">각 영역별 최저 3학점 이상 이수</span>
          </div>
        </div>

        {/* 자유교양 */}
        <div className="grid grid-cols-[160px_120px_1fr_120px_220px] bg-white border-t-2 border-slate-400">
          <div className="border-r-2 border-slate-400 p-4 flex items-center justify-center">
            <span className="font-bold text-gray-900">자유교양</span>
          </div>
          <div className="border-r-2 border-slate-400 p-4 flex items-center justify-center">
            <span className="font-bold text-gray-900 text-2xl">2</span>
          </div>
          <div className="border-r-2 border-slate-400 p-4"></div>
          <div className="border-r-2 border-slate-400 p-4"></div>
          <div className="p-4 flex items-center justify-center">
            <span className="text-gray-900 font-semibold">필수</span>
          </div>
        </div>

        {/* 전공선택 */}
        <div className="grid grid-cols-[160px_120px_1fr_120px_220px] bg-white border-t-2 border-slate-400">
          <div className="border-r-2 border-slate-400 p-4 flex items-center justify-center">
            <span className="font-bold text-gray-900">전공선택</span>
          </div>
          <div className="border-r-2 border-slate-400 p-4 flex items-center justify-center">
            <span className="font-bold text-gray-900 text-2xl">48</span>
          </div>
          <div className="border-r-2 border-slate-400 p-4 flex items-center">
            <div className="space-y-2">
              <p className="text-gray-900 font-semibold">사제동행세미나</p>
              <p className="text-gray-900 font-semibold">유레카프로젝트</p>
              <p className="text-gray-900 font-semibold">현대경영과기업가정신</p>
              <p className="text-gray-900 font-semibold">경영통계</p>
              <p className="text-gray-900 font-semibold">회계학원론</p>
              <p className="text-gray-900 font-semibold">인공지능수학</p>
              <p className="text-gray-900 font-semibold">경영정보학원론</p>
              <p className="text-gray-900 font-semibold">회귀분석</p>
              <p className="text-gray-900 font-semibold">머신러닝</p>
              <p className="text-gray-900 font-semibold">딥러닝</p>
              <p className="text-gray-900 font-semibold">AI빅데이터프로그래밍 I</p>
              <p className="text-gray-900 font-semibold">AI빅데이터프로그래밍 II</p>
            </div>
          </div>
          <div className="border-r-2 border-slate-400 p-4 flex items-center">
            <div className="space-y-2 text-center w-full">
              <p className="font-bold text-gray-900">1</p>
              <p className="font-bold text-gray-900">3</p>
              <p className="font-bold text-gray-900">3</p>
              <p className="font-bold text-gray-900">3</p>
              <p className="font-bold text-gray-900">3</p>
              <p className="font-bold text-gray-900">3</p>
              <p className="font-bold text-gray-900">3</p>
              <p className="font-bold text-gray-900">3</p>
              <p className="font-bold text-gray-900">3</p>
              <p className="font-bold text-gray-900">3</p>
              <p className="font-bold text-gray-900">3</p>
              <p className="font-bold text-gray-900">3</p>
            </div>
          </div>
          <div className="p-4 flex items-center justify-center">
            <span className="text-gray-900 font-semibold">필수</span>
          </div>
        </div>

        {/* 일반선택 */}
        <div className="grid grid-cols-[160px_120px_1fr_120px_220px] bg-white border-t-2 border-slate-400">
          <div className="border-r-2 border-slate-400 p-4 flex items-center justify-center">
            <span className="font-bold text-gray-900">일반선택</span>
          </div>
          <div className="border-r-2 border-slate-400 p-4 flex items-center justify-center">
            <span className="font-bold text-gray-900 text-2xl">58</span>
          </div>
          <div className="p-4 col-span-3">
            <p className="text-gray-900 font-semibold">
              영역별 최저이수학점 충족과정,<br />
              타과전공, 교직, 다(부)전공 이수학점
            </p>
          </div>
        </div>

        {/* 푸터 */}
        <div className="grid grid-cols-2 bg-blue-50 border-t-2 border-slate-400">
          <div className="border-r-2 border-slate-400 p-4 flex items-center justify-center">
            <span className="text-gray-900 font-bold text-xl">총 졸업이수학점</span>
          </div>
          <div className="p-4 flex items-center justify-center">
            <span className="text-gray-900 font-bold text-2xl">130</span>
          </div>
        </div>
      </div>
    </div>
  );
}
