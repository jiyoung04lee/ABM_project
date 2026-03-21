export function EducationGoalDiagram() {
  return (
    <div className="w-full py-4 md:py-8 space-y-5 md:space-y-8">
      {/* 융합역량 */}
      <div>
        <div className="flex items-stretch gap-3 md:gap-4">
          <div className="w-20 md:w-32 bg-gradient-to-br from-[#2563EB] to-[#1e40af] rounded-2xl flex items-center justify-center px-3 py-4 md:p-4 flex-shrink-0 shadow-md">
            <h3 className="text-white font-bold text-base md:text-xl text-center leading-tight break-keep">
              융합
              <br />
              역량
            </h3>
          </div>

          <div className="flex-1 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-3 md:p-6 border border-blue-200">
            <div className="flex flex-col md:flex-row md:items-stretch gap-3 md:gap-6">
              <div className="bg-white border-2 border-[#2563EB] rounded-xl p-4 md:p-6 shadow-md md:flex-1 flex items-center justify-center">
                <h4 className="text-[#1e40af] font-bold text-center text-sm leading-relaxed break-keep">
                  AI·빅데이터 기반의
                  <br />
                  디지털 경영
                </h4>
              </div>

              <div className="grid grid-cols-1 gap-2 md:flex-1">
                <div className="bg-white rounded-xl p-3 border-2 border-[#2563EB] shadow-sm">
                  <p className="text-center text-sm font-bold text-[#1e40af] break-keep">
                    디지털마케팅
                  </p>
                </div>
                <div className="bg-white rounded-xl p-3 border-2 border-[#2563EB] shadow-sm">
                  <p className="text-center text-sm font-bold text-[#1e40af] break-keep">
                    디지털금융 & 핀테크
                  </p>
                </div>
                <div className="bg-white rounded-xl p-3 border-2 border-[#2563EB] shadow-sm">
                  <p className="text-center text-sm font-bold text-[#1e40af] break-keep">
                    디지털SCM
                  </p>
                </div>
                <div className="bg-white rounded-xl p-3 border-2 border-[#2563EB] shadow-sm">
                  <p className="text-center text-sm font-bold text-[#1e40af] break-keep">
                    디지털HR
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 핵심역량 */}
      <div>
        <div className="flex items-stretch gap-3 md:gap-4">
          <div className="w-20 md:w-32 bg-gradient-to-br from-[#2563EB] to-[#1e40af] rounded-2xl flex items-center justify-center px-3 py-4 md:p-4 flex-shrink-0 shadow-md">
            <h3 className="text-white font-bold text-base md:text-xl text-center leading-tight break-keep">
              핵심
              <br />
              역량
            </h3>
          </div>

          <div className="flex-1 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-3 md:p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4">
              <div className="bg-white rounded-xl p-4 md:p-5 border-2 border-[#2563EB] shadow-sm hover:shadow-md transition-all">
                <h4 className="text-[#1e40af] font-bold text-center text-sm break-keep">
                  빅데이터 활용
                </h4>
              </div>
              <div className="bg-white rounded-xl p-4 md:p-5 border-2 border-[#2563EB] shadow-sm hover:shadow-md transition-all">
                <h4 className="text-[#1e40af] font-bold text-center text-sm break-keep">
                  인공지능 응용
                </h4>
              </div>
              <div className="bg-white rounded-xl p-4 md:p-5 border-2 border-[#2563EB] shadow-sm hover:shadow-md transition-all">
                <h4 className="text-[#1e40af] font-bold text-center text-sm break-keep">
                  비즈니스 이해
                </h4>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 기초역량 */}
      <div>
        <div className="flex items-stretch gap-3 md:gap-4">
          <div className="w-20 md:w-32 bg-gradient-to-br from-[#2563EB] to-[#1e40af] rounded-2xl flex items-center justify-center px-3 py-4 md:p-4 flex-shrink-0 shadow-md">
            <h3 className="text-white font-bold text-base md:text-xl text-center leading-tight break-keep">
              기초
              <br />
              역량
            </h3>
          </div>

          <div className="flex-1 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-3 md:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4 max-w-2xl">
              <div className="bg-white rounded-xl p-4 md:p-5 border-2 border-[#2563EB] shadow-sm hover:shadow-md transition-all">
                <h4 className="text-[#1e40af] font-bold text-center text-sm break-keep">
                  SW 기초
                </h4>
              </div>
              <div className="bg-white rounded-xl p-4 md:p-5 border-2 border-[#2563EB] shadow-sm hover:shadow-md transition-all">
                <h4 className="text-[#1e40af] font-bold text-center text-sm break-keep">
                  수학/통계학 기초
                </h4>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}