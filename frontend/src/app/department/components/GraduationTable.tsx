export function GraduationTable() {
  const sections = [
    {
      title: "기초교양",
      credits: "7",
      subjects: [
        { name: "글쓰기", credit: "3" },
        { name: "College English I, II", credit: "2" },
        { name: "English Conversation I, II", credit: "2" },
      ],
      description: ["글쓰기 필수", "영어 과목 중 택1 이수"],
    },
    {
      title: "핵심교양",
      credits: "15",
      subjects: [
        { name: "인문 I", credit: "3" },
        { name: "인문 II", credit: "3" },
        { name: "소통", credit: "3" },
        { name: "글로벌", credit: "3" },
        { name: "창의", credit: "3" },
      ],
      description: ["각 영역별 최저 3학점 이상 이수"],
    },
    {
      title: "자유교양",
      credits: "2",
      subjects: [],
      description: ["필수"],
    },
    {
      title: "전공선택",
      credits: "48",
      subjects: [
        { name: "사제동행세미나", credit: "1" },
        { name: "유레카프로젝트", credit: "3" },
        { name: "현대경영과기업가정신", credit: "3" },
        { name: "경영통계", credit: "3" },
        { name: "회계학원론", credit: "3" },
        { name: "인공지능수학", credit: "3" },
        { name: "경영정보학원론", credit: "3" },
        { name: "회귀분석", credit: "3" },
        { name: "머신러닝", credit: "3" },
        { name: "딥러닝", credit: "3" },
        { name: "AI빅데이터프로그래밍 I", credit: "3" },
        { name: "AI빅데이터프로그래밍 II", credit: "3" },
      ],
      description: ["필수"],
    },
    {
      title: "일반선택",
      credits: "58",
      subjects: [
        {
          name: "영역별 최저이수학점 충족과정, 타과전공, 교직, 다(부)전공 이수학점",
          credit: "",
        },
      ],
      description: [],
    },
  ];

  return (
    <div className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-8 shadow-sm">
      <div className="mb-5 md:mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900 leading-snug">
          AI빅데이터융합경영학과 · 졸업 이수학점 요건
        </h2>
      </div>

      {/* 모바일 */}
      <div className="block md:hidden space-y-4">
        {sections.map((section) => (
          <div
            key={section.title}
            className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4"
          >
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-base font-bold text-[#1e40af]">
                {section.title}
              </h3>
              <div className="px-3 py-1.5 rounded-full bg-white border border-blue-300 text-sm font-bold text-[#1e40af] shrink-0">
                {section.credits}학점
              </div>
            </div>

            {section.subjects.length > 0 ? (
              <div className="space-y-2">
                {section.subjects.map((subject, idx) => (
                  <div
                    key={`${section.title}-${idx}`}
                    className="rounded-xl bg-white border border-blue-100 px-3 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-gray-900 leading-relaxed break-keep">
                        {subject.name}
                      </p>
                      {subject.credit && (
                        <span className="text-sm font-bold text-[#1e40af] shrink-0">
                          {subject.credit}학점
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl bg-white border border-blue-100 px-3 py-3 text-sm font-semibold text-gray-900">
                별도 교과목 없음
              </div>
            )}

            {section.description.length > 0 && (
              <div className="mt-3 space-y-1">
                {section.description.map((text, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl bg-white/80 px-3 py-2 text-xs text-gray-700 font-medium leading-relaxed"
                  >
                    {text}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        <div className="rounded-2xl bg-gradient-to-r from-[#2563EB] to-[#4f46e5] text-white p-4 flex items-center justify-between">
          <span className="text-base font-bold">총 졸업이수학점</span>
          <span className="text-2xl font-bold">130</span>
        </div>
      </div>

      {/* 웹 */}
      <div className="hidden md:block border-2 border-slate-400 rounded-2xl overflow-hidden">
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
              <p className="text-gray-900 font-semibold">글쓰기 필수</p>
              <p className="text-gray-900 font-semibold">영어 과목 중 택1 이수</p>
            </div>
          </div>
        </div>

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
            <span className="text-gray-900 font-semibold">
              각 영역별 최저 3학점 이상 이수
            </span>
          </div>
        </div>

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

        <div className="grid grid-cols-[160px_120px_1fr_120px_220px] bg-white border-t-2 border-slate-400">
          <div className="border-r-2 border-slate-400 p-4 flex items-center justify-center">
            <span className="font-bold text-gray-900">일반선택</span>
          </div>
          <div className="border-r-2 border-slate-400 p-4 flex items-center justify-center">
            <span className="font-bold text-gray-900 text-2xl">58</span>
          </div>
          <div className="p-4 col-span-3">
            <p className="text-gray-900 font-semibold">
              영역별 최저이수학점 충족과정,
              <br />
              타과전공, 교직, 다(부)전공 이수학점
            </p>
          </div>
        </div>

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