import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { isLegalSlug, LEGAL_SLUGS, legalDoc } from "@/legal";
import type { LegalBlock } from "@/legal/types";

// 개인정보처리방침·이용약관·위치기반서비스 이용약관(공개 페이지). 본문은 언어별
// 콘텐츠 파일(src/legal)이 들고, 여기서는 그리기만 한다. 로그인 없이 열린다 - Play
// Console과 스토어 등록정보가 이 주소를 가리킨다.
type Props = { params: Promise<{ doc: string }> };

async function load(params: Props["params"]) {
  const { doc } = await params;
  if (!isLegalSlug(doc)) notFound();
  const t = await getTranslations("legal");
  return { slug: doc, t, content: legalDoc(doc, await getLocale(), t("missing")) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { content } = await load(params);
  return { title: content.title };
}

function Block({ block }: { block: LegalBlock }) {
  if (typeof block === "string") return <p>{block}</p>;
  if ("list" in block) {
    return (
      <ul className="flex list-disc flex-col gap-1.5 pl-5">
        {block.list.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }
  return (
    // 세 칸 이상인 표는 폰 폭에서 좁아 표만 가로로 밀어 본다(페이지는 넘치지 않게).
    <div className="-mx-6 overflow-x-auto px-6">
      <table
        className={`w-full border-collapse text-left text-sm ${block.table.head.length > 2 ? "min-w-[32rem]" : ""}`}
      >
        <thead>
          <tr>
            {block.table.head.map((h) => (
              <th key={h} className="border-border text-foreground border-b py-2 pr-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.table.rows.map((row) => (
            <tr key={row.join("|")}>
              {row.map((cell, i) => (
                <td key={i} className="border-border border-b py-2 pr-3 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function LegalPage({ params }: Props) {
  const { slug, t, content } = await load(params);
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-12 break-keep">
      <div className="flex flex-col gap-3">
        <h1 className="text-foreground text-3xl font-semibold tracking-tight">{content.title}</h1>
        <p className="text-muted-foreground">{content.intro}</p>
      </div>
      {content.sections.map((section) => (
        <section
          key={section.heading}
          className="text-muted-foreground flex flex-col gap-3 text-sm leading-relaxed"
        >
          <h2 className="text-foreground text-base font-semibold">{section.heading}</h2>
          {section.blocks.map((block, i) => (
            <Block key={i} block={block} />
          ))}
        </section>
      ))}
      <nav
        aria-label={t("others")}
        className="border-border flex flex-wrap gap-x-4 gap-y-2 border-t pt-6 text-sm"
      >
        {LEGAL_SLUGS.filter((s) => s !== slug).map((s) => (
          <Link
            key={s}
            href={`/legal/${s}`}
            className="text-primary underline-offset-4 hover:underline"
          >
            {t(s)}
          </Link>
        ))}
      </nav>
    </main>
  );
}
