"use client";

import { useState } from "react";
import {
  Target,
  Sparkles,
  Lightbulb,
  Play,
  GraduationCap,
  BookOpen,
} from "lucide-react";
import { EducationGoalDiagram } from "@/app/department/components/EducationGoalDiagram";
import { GraduationTable } from "@/app/department/components/GraduationTable";

type TabId = "intro" | "graduation" | "glossary" | "curriculum";

const tabs: { id: TabId; label: string }[] = [
  { id: "intro", label: "학과 소개" },
  { id: "graduation", label: "졸업 요건" },
  { id: "glossary", label: "학회 소개집" },
  { id: "curriculum", label: "커리큘럼" },
];

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
        active
          ? "bg-gradient-to-r from-[#2563EB] to-[#4f46e5] text-white shadow-md"
          : "bg-white text-gray-600 hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );
}

function IntroContent({ mobile = false }: { mobile?: boolean }) {
  return (
    <>
      <div
        className={`bg-white shadow-sm ${
          mobile ? "rounded-2xl p-5 mb-4" : "rounded-3xl p-8 mb-6"
        }`}
      >
        {mobile ? (
          <>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                <Target className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold">학과 소개</h2>
            </div>

            <div className="mb-5">
              <a
                href="https://www.youtube.com/watch?v=G4-QILt2f28&t=9s"
                target="_blank"
                rel="noopener noreferrer"
                className="block group"
              >
                <div className="rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300">
                  <div className="relative aspect-video">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="https://img.youtube.com/vi/G4-QILt2f28/maxresdefault.jpg"
                      alt="AI빅데이터융합경영학과 소개 영상"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-all duration-300" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-[#2563EB] rounded-full flex items-center justify-center shadow-2xl group-hover:bg-[#1d4ed8] group-hover:scale-110 transition-all duration-300 w-16 h-16">
                        <Play
                          className="w-8 h-8 text-white ml-1"
                          fill="white"
                        />
                      </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                      <p className="text-white font-medium text-sm">
                        AI빅데이터융합경영학과 소개 영상
                      </p>
                    </div>
                  </div>
                </div>
              </a>
            </div>

            <div className="text-gray-700 leading-relaxed space-y-4 text-[15px]">
              <p>
                AI와 빅데이터를 활용한 업무 자동화와 효율화는 기업 운영 전반에서 비용 절감을 이끌고 있으며,
                이를 기반으로 한 새로운 비즈니스 영역이 빠르게 확장되고 있습니다. 이에 따라 마케팅,
                인사·조직, 금융, 생산관리 등 다양한 산업 분야의 실무와 경영 환경 역시 빅데이터와 AI를
                응용하는 방식으로 변화하고 있습니다.
              </p>
              <p>
                AI빅데이터융합경영학과는 이러한 산업 변화에 대응하여 비즈니스에 대한 이해와 협업 역량을 갖춘
                창의적 혁신가, 빅데이터 기반의 문제 해결 역량을 지닌 분석 전문가, AI를 실제 현장에
                응용·활용할 수 있는 융합형 인재를 양성하는 것을 목표로 합니다.
              </p>
            </div>
          </>
        ) : (
          <div className="flex items-start gap-4">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center flex-shrink-0 w-10 h-10">
              <Target className="w-5 h-5 text-white" />
            </div>

            <div className="flex-1">
              <h2 className="font-bold text-2xl mb-6">학과 소개</h2>

              <div className="max-w-3xl mx-auto mb-6">
                <a
                  href="https://www.youtube.com/watch?v=G4-QILt2f28&t=9s"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block group"
                >
                  <div className="rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300">
                    <div className="relative aspect-video">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="https://img.youtube.com/vi/G4-QILt2f28/maxresdefault.jpg"
                        alt="AI빅데이터융합경영학과 소개 영상"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-all duration-300" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-[#2563EB] rounded-full flex items-center justify-center shadow-2xl group-hover:bg-[#1d4ed8] group-hover:scale-110 transition-all duration-300 w-20 h-20">
                          <Play
                            className="w-10 h-10 text-white ml-1"
                            fill="white"
                          />
                        </div>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                        <p className="text-white font-medium">
                          AI빅데이터융합경영학과 소개 영상
                        </p>
                      </div>
                    </div>
                  </div>
                </a>
              </div>

              <div className="text-gray-700 leading-relaxed space-y-5 text-base">
                <p>
                  AI와 빅데이터를 활용한 업무 자동화와 효율화는 기업 운영 전반에서 비용 절감을 이끌고 있으며,
                  이를 기반으로 한 새로운 비즈니스 영역이 빠르게 확장되고 있습니다. 이에 따라 마케팅,
                  인사·조직, 금융, 생산관리 등 다양한 산업 분야의 실무와 경영 환경 역시 빅데이터와 AI를
                  응용하는 방식으로 변화하고 있습니다.
                </p>
                <p>
                  AI빅데이터융합경영학과는 이러한 산업 변화에 대응하여 비즈니스에 대한 이해와 협업 역량을 갖춘
                  창의적 혁신가, 빅데이터 기반의 문제 해결 역량을 지닌 분석 전문가, AI를 실제 현장에
                  응용·활용할 수 있는 융합형 인재를 양성하는 것을 목표로 합니다.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div
        className={`bg-white shadow-sm ${
          mobile ? "rounded-2xl p-5 mb-4" : "rounded-3xl p-8 mb-6"
        }`}
      >
        <div className={`flex items-center gap-3 ${mobile ? "mb-5" : "mb-8"}`}>
          <div
            className={`bg-gradient-to-br from-indigo-600 to-blue-600 rounded-2xl flex items-center justify-center flex-shrink-0 ${
              mobile ? "w-11 h-11" : "w-10 h-10"
            }`}
          >
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <h2 className={`font-bold ${mobile ? "text-xl" : "text-2xl"}`}>
            교육 목표
          </h2>
        </div>

        <div className="max-w-4xl mx-auto overflow-x-auto">
          <EducationGoalDiagram />
        </div>
      </div>

      <div
        className={`bg-gradient-to-br from-blue-50 to-indigo-50 shadow-sm ${
          mobile ? "rounded-2xl p-5" : "rounded-3xl p-8"
        }`}
      >
        <div className={`flex items-center gap-3 ${mobile ? "mb-5" : "mb-6"}`}>
          <div
            className={`bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center flex-shrink-0 ${
              mobile ? "w-11 h-11" : "w-10 h-10"
            }`}
          >
            <Lightbulb className="w-5 h-5 text-white" />
          </div>
          <h2 className={`font-bold ${mobile ? "text-lg leading-snug" : "text-2xl"}`}>
            교육형태: Why AI빅데이터융합경영학과?
          </h2>
        </div>

        <div
          className={`bg-white ${
            mobile ? "rounded-2xl p-5 space-y-4 text-[15px]" : "rounded-2xl p-6 space-y-5 text-base"
          } text-gray-700 leading-relaxed`}
        >
          <div>
            <p className="font-semibold text-gray-900 flex items-center gap-2 mb-2">
              <span className="text-blue-600">●</span> 융합교육에 최적화된 커리큘럼
            </p>
            <p>
              AI빅데이터융합경영학과는 소프트웨어, 수학·통계, 빅데이터, 인공지능, 비즈니스를 단계적으로 학습하는
              융합형 교육과정을 운영합니다.
            </p>
            <p className="mt-2">
              1~2학년에는 기초 역량을, 2~3학년에는 핵심 역량을, 4학년에는 산학협력 및 캡스톤디자인을 통해 실무
              융합 역량을 완성합니다.
            </p>
            <p className="mt-2">
              팀팀Class, 캡스톤디자인 교과목 등 정부, 기업, 지역사회기관 등과 함께 협업하여 해결책을 제시하고
              변화를 만들어내는 실용적 융합교육 모델을 운영합니다.
            </p>
          </div>

          <div>
            <p className="font-semibold text-gray-900 flex items-center gap-2 mb-2">
              <span className="text-blue-600">●</span> 산업계 수요 맞춤형 교육 진행
            </p>
            <p>
              산업현장의 실제 데이터세트를 가지고 현장 문제를 분석하고 해결책을 찾는 실무중심의 과목을 개설하고
              AI빅데이터 전문기업 및 공공기관과의 제휴를 통하여 실무 전문가의 특강과 팀티칭을 제공합니다.
            </p>
          </div>

          <div>
            <p className="font-semibold text-gray-900 flex items-center gap-2 mb-2">
              <span className="text-blue-600">●</span> 최첨단 실습환경과 최적의 온·오프라인 강의 제공
            </p>
            <p>
              최신 GPU가 탑재된 딥러닝 교육 서버를 구축하여 최대 120명이 동시에 딥러닝 실습이 가능한 실습 환경을
              제공합니다.
            </p>
            <p className="mt-2">
              수준 높은 비대면 강의 콘텐츠 제작을 위한 K*STUDIO, 모빌리티가 강화된 최첨단 멀티미디어 계단식
              강의실로 최적의 온·오프라인 강의 환경을 경험할 수 있습니다.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function GraduationContent({ mobile = false }: { mobile?: boolean }) {
  const infoItems = [
    "교양교과목(기초교양 + 핵심교양 + 자유교양)은 50학점을 초과하여 이수할 수 없음.",
    "S-TEAM Class 미이수 시 사제동행세미나를 이수해야 함.",
    "S-TEAM Class 및 사제동행세미나 수업은 재학 중 최대 4학점까지만 이수 가능함.",
    "졸업인증제 충족",
  ];

  const cautionItems = [
    "졸업 요건은 입학년도에 따라 다를 수 있습니다.",
    "학사 규정 변경 시 개정된 규정을 따릅니다.",
    "복수전공, 부전공 이수 시 추가 요건이 있을 수 있습니다.",
    "자세한 사항은 학과 사무실에 문의해주세요.",
  ];

  return (
    <>
      <div className={mobile ? "mb-4" : "mb-6"}>
        <GraduationTable />
      </div>

      <div
        className={`bg-white shadow-sm ${
          mobile ? "rounded-2xl p-5" : "rounded-3xl p-8"
        }`}
      >
        {mobile ? (
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center flex-shrink-0">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">추가 졸업 요건</h2>
              <p className="text-xs text-gray-500 mt-1">
                학점 이수 외에 확인해야 할 사항
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <GraduationCap className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-1">추가 졸업 요건</h2>
              <p className="text-gray-600">
                학점 이수 외에 충족해야 하는 졸업 요건입니다.
              </p>
            </div>
          </div>
        )}

        <div className={mobile ? "space-y-4" : "grid grid-cols-2 gap-6"}>
          {/* 추가 정보 사항 */}
          <section
            className={`bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 ${
              mobile ? "rounded-2xl p-4" : "rounded-3xl p-6"
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`bg-white border border-blue-200 rounded-xl flex items-center justify-center shrink-0 ${
                  mobile ? "w-10 h-10" : "w-11 h-11"
                }`}
              >
                <span className="text-blue-700 font-bold">✓</span>
              </div>
              <div>
                <h3 className={`font-bold text-blue-900 ${mobile ? "text-base" : "text-lg"}`}>
                  추가 정보 사항
                </h3>
                {!mobile && (
                  <p className="text-sm text-blue-800/80 mt-1">
                    졸업 전 반드시 확인해야 하는 기본 조건
                  </p>
                )}
              </div>
            </div>

            <div
              className={`bg-white border border-blue-100 ${
                mobile ? "rounded-2xl p-4" : "rounded-2xl p-5"
              }`}
            >
              <ul className={mobile ? "space-y-3" : "space-y-4"}>
                {infoItems.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="mt-0.5 text-blue-600 text-sm">●</span>
                    <span
                      className={`text-gray-700 leading-relaxed ${
                        mobile ? "text-sm" : "text-[15px]"
                      }`}
                    >
                      {item}
                    </span>
                  </li>
                ))}

                <li className="ml-5 rounded-xl bg-blue-50 px-3 py-3 border border-blue-100">
                  <p className="font-semibold text-blue-900 text-sm mb-1">
                    공통요건
                  </p>
                  <p className={`text-gray-700 ${mobile ? "text-sm" : "text-[15px]"}`}>
                    심화전공 또는 다부전공 중 1가지 이상 이수
                  </p>
                </li>
              </ul>
            </div>
          </section>

          {/* 유의사항 */}
          <section
            className={`bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 ${
              mobile ? "rounded-2xl p-4" : "rounded-3xl p-6"
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`bg-white border border-amber-200 rounded-xl flex items-center justify-center shrink-0 ${
                  mobile ? "w-10 h-10" : "w-11 h-11"
                }`}
              >
                <span className="text-amber-600 font-bold">!</span>
              </div>
              <div>
                <h3 className={`font-bold text-amber-900 ${mobile ? "text-base" : "text-lg"}`}>
                  유의사항
                </h3>
                {!mobile && (
                  <p className="text-sm text-amber-800/80 mt-1">
                    최종 확인 전 참고해야 하는 안내
                  </p>
                )}
              </div>
            </div>

            <div
              className={`bg-white border border-amber-100 ${
                mobile ? "rounded-2xl p-4" : "rounded-2xl p-5"
              }`}
            >
              <ul className={mobile ? "space-y-3" : "space-y-4"}>
                {cautionItems.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="mt-0.5 text-amber-600 text-sm">•</span>
                    <span
                      className={`text-gray-700 leading-relaxed ${
                        mobile ? "text-sm" : "text-[15px]"
                      }`}
                    >
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function GlossaryContent({ mobile = false }: { mobile?: boolean }) {
  return (
    <div
      className={`bg-white shadow-sm ${
        mobile ? "rounded-2xl p-5" : "rounded-3xl p-8"
      }`}
    >
      {mobile ? (
        <>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-2xl flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold">학회 소개집</h2>
          </div>

          <div className="max-w-4xl mx-auto flex flex-col gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/ins_image_XAI.png"
              alt="학회 소개집 1"
              className="w-full h-auto rounded-2xl shadow-sm"
            />

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/ins_image_DA.png"
              alt="학회 소개집 2"
              className="w-full h-auto rounded-2xl shadow-sm"
            />
          </div>
        </>
      ) : (
        <div className="flex items-start gap-4">
          <div className="bg-gradient-to-br from-indigo-600 to-blue-600 rounded-2xl flex items-center justify-center flex-shrink-0 w-14 h-14">
            <BookOpen className="w-7 h-7 text-white" />
          </div>

          <div className="flex-1">
            <h2 className="font-bold text-2xl mb-6">학회 소개집</h2>

            <div className="max-w-4xl mx-auto flex flex-col gap-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/ins_image_XAI.png"
                alt="학회 소개집 1"
                className="w-full h-auto rounded-2xl shadow-sm"
              />

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/ins_image_DA.png"
                alt="학회 소개집 2"
                className="w-full h-auto rounded-2xl shadow-sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CurriculumContent({ mobile = false }: { mobile?: boolean }) {
  const items = [
    {
      year: "1학년",
      desc: "소프트웨어 기초, 수학·통계 기초, 빅데이터 기초, 인공지능 기초, 비즈니스 기초 등을 배웁니다.",
      color: "blue",
    },
    {
      year: "2학년",
      desc: "소프트웨어 응용, 수학·통계 응용, 빅데이터 응용, 인공지능 응용, 비즈니스 응용 등을 배웁니다.",
      color: "indigo",
    },
    {
      year: "3학년",
      desc: "소프트웨어 고급, 수학·통계 고급, 빅데이터 고급, 인공지능 고급, 비즈니스 고급 등을 배웁니다.",
      color: "blue",
    },
    {
      year: "4학년",
      desc: "산학협력 프로젝트, 캡스톤 디자인 프로젝트 등을 수행합니다.",
      color: "indigo",
    },
  ];

  return (
    <div
      className={`bg-white shadow-sm ${
        mobile ? "rounded-2xl p-5" : "rounded-3xl p-8"
      }`}
    >
      {mobile ? (
        <>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold">커리큘럼</h2>
          </div>

          <div className="max-w-4xl mx-auto mb-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/curriculum-roadmap.png"
              alt="커리큘럼 다이어그램: 1학년, 2학년, 3학년, 4학년"
              className="w-full h-auto rounded-2xl shadow-sm"
            />
          </div>

          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.year}
                className={`bg-gradient-to-r ${
                  item.color === "blue"
                    ? "from-blue-50 to-blue-100 border-blue-600"
                    : "from-indigo-50 to-indigo-100 border-indigo-600"
                } rounded-2xl border-l-4 p-4`}
              >
                <h3
                  className={`font-bold mb-2 ${
                    item.color === "blue" ? "text-blue-700" : "text-indigo-700"
                  } text-base`}
                >
                  {item.year}
                </h3>
                <p className="text-gray-700 leading-relaxed text-sm">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex items-start gap-4">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center flex-shrink-0 w-14 h-14">
            <BookOpen className="w-7 h-7 text-white" />
          </div>

          <div className="flex-1">
            <h2 className="font-bold text-2xl mb-6">커리큘럼</h2>

            <div className="max-w-4xl mx-auto mb-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/curriculum-roadmap.png"
                alt="커리큘럼 다이어그램: 1학년, 2학년, 3학년, 4학년"
                className="w-full h-auto rounded-2xl shadow-sm"
              />
            </div>

            <div className="space-y-4">
              {items.map((item) => (
                <div
                  key={item.year}
                  className={`bg-gradient-to-r ${
                    item.color === "blue"
                      ? "from-blue-50 to-blue-100 border-blue-600"
                      : "from-indigo-50 to-indigo-100 border-indigo-600"
                  } rounded-2xl border-l-4 p-5`}
                >
                  <h3
                    className={`font-bold mb-2 ${
                      item.color === "blue" ? "text-blue-700" : "text-indigo-700"
                    } text-lg`}
                  >
                    {item.year}
                  </h3>
                  <p className="text-gray-700 leading-relaxed text-sm">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MobileDepartmentPage() {
  const [activeTab, setActiveTab] = useState<TabId>("intro");

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-100 via-indigo-50 to-blue-50 border-b border-gray-200">
        <div className="absolute top-0 left-0 w-56 h-56 bg-blue-300 rounded-full blur-3xl opacity-25" />
        <div className="absolute top-0 right-0 w-56 h-56 bg-indigo-300 rounded-full blur-3xl opacity-25" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-56 h-56 bg-blue-400 rounded-full blur-3xl opacity-20" />

        <div className="relative z-10 px-5 pt-24 pb-10 flex flex-col items-center text-center">
          <div className="inline-block mb-3 px-3 py-1.5 bg-indigo-100 text-indigo-800 rounded-full text-xs font-medium">
            ✨ AI빅데이터융합경영 이렇게 공부하기
          </div>

          <h1 className="text-[clamp(1.9rem,5vw,2.4rem)] font-bold leading-tight mb-4 whitespace-nowrap">
            AI빅데이터융합경영학과
          </h1>

          <p className="text-gray-700 text-sm leading-relaxed">
            데이터로 세상을 읽고,
            <br />
            AI로 미래를 창조하다.
            <br />
            사람과 창의적 생각이 담긴 경영에서!
          </p>
        </div>
      </div>

      <div className="px-4 py-5">
        <div className="grid grid-cols-2 gap-2 mb-5">
          {tabs.map((tab) => (
            <TabButton
              key={tab.id}
              active={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              label={tab.label}
            />
          ))}
        </div>

        {activeTab === "intro" && <IntroContent mobile />}
        {activeTab === "graduation" && <GraduationContent mobile />}
        {activeTab === "glossary" && <GlossaryContent mobile />}
        {activeTab === "curriculum" && <CurriculumContent mobile />}
      </div>
    </div>
  );
}

function DesktopDepartmentPage() {
  const [activeTab, setActiveTab] = useState<TabId>("intro");

  return (
    <div className="-mt-20 min-h-screen bg-white">
      <div className="bg-gradient-to-br from-blue-100 via-indigo-50 to-blue-50 border-b border-gray-200 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30" />
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30" />

        <div className="max-w-5xl mx-auto px-4 pt-32 pb-16 text-center relative z-10">
          <div className="inline-block mb-4 px-4 py-2 bg-indigo-100 text-indigo-800 rounded-full text-sm">
            ✨ AI빅데이터융합경영 이렇게 공부하기
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">AI빅데이터융합경영학과</h1>
          <p className="text-gray-700 text-lg">
            데이터로 세상을 읽고, AI로 미래를 창조하다.
            <br />
            사람과 창의적 생각이 담긴 경영에서!
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl p-2 mb-10 shadow-sm border border-gray-200">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-6 py-3 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === tab.id
                    ? "bg-gradient-to-r from-[#2563EB] to-[#4f46e5] text-white shadow-md"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "intro" && <IntroContent />}
        {activeTab === "graduation" && <GraduationContent />}
        {activeTab === "glossary" && <GlossaryContent />}
        {activeTab === "curriculum" && <CurriculumContent />}
      </div>
    </div>
  );
}

export default function DepartmentPage() {
  return (
    <>
      <div className="hidden md:block">
        <DesktopDepartmentPage />
      </div>

      <div className="block md:hidden">
        <MobileDepartmentPage />
      </div>
    </>
  );
}