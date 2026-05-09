import { useState } from "react";
import currentLawContent from "../docs/current.md?raw";
import proposedLawContent from "../docs/proposed.md?raw";

function renderMarkdown(markdown) {
  const lines = markdown.split("\n");
  const blocks = [];
  let paragraphLines = [];
  let listItems = [];
  let listType = null;

  const flushParagraph = () => {
    if (paragraphLines.length === 0) {
      return;
    }

    blocks.push({
      type: "paragraph",
      content: paragraphLines.join(" "),
    });
    paragraphLines = [];
  };

  const flushList = () => {
    if (listItems.length === 0) {
      return;
    }

    blocks.push({
      type: listType ?? "unordered-list",
      items: listItems,
    });
    listItems = [];
    listType = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    if (trimmed.startsWith("### ")) {
      flushParagraph();
      flushList();
      blocks.push({
        type: "heading",
        level: 3,
        content: trimmed.slice(4),
      });
      continue;
    }

    if (trimmed.startsWith("## ")) {
      flushParagraph();
      flushList();
      blocks.push({
        type: "heading",
        level: 2,
        content: trimmed.slice(3),
      });
      continue;
    }

    if (trimmed.startsWith("# ")) {
      flushParagraph();
      flushList();
      blocks.push({
        type: "heading",
        level: 1,
        content: trimmed.slice(2),
      });
      continue;
    }

    if (trimmed.startsWith("- ")) {
      flushParagraph();
      if (listType && listType !== "unordered-list") {
        flushList();
      }
      listType = "unordered-list";
      listItems.push(trimmed.slice(2));
      continue;
    }

    if (/^\d+\)/.test(trimmed)) {
      flushParagraph();
      if (listType && listType !== "ordered-list") {
        flushList();
      }
      listType = "ordered-list";
      listItems.push(trimmed);
      continue;
    }

    if (listItems.length > 0) {
      listItems[listItems.length - 1] =
        `${listItems[listItems.length - 1]} ${trimmed}`.trim();
      continue;
    }

    paragraphLines.push(trimmed);
  }

  flushParagraph();
  flushList();

  return blocks;
}

function MarkdownContent({ markdown }) {
  const blocks = renderMarkdown(markdown);

  return (
    <div className="markdown-content">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          if (block.level === 1) {
            return <h3 key={index}>{block.content}</h3>;
          }

          if (block.level === 2) {
            return <h4 key={index}>{block.content}</h4>;
          }

          return <h5 key={index}>{block.content}</h5>;
        }

        if (block.type === "list") {
          return (
            <ul key={index}>
              {block.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          );
        }

        if (block.type === "ordered-list") {
          return (
            <ol key={index} className="legal-list">
              {block.items.map((item) => {
                const match = item.match(/^(\d+\))(.*)$/);
                const marker = match?.[1] ?? "";
                const content = match?.[2]?.trim() ?? item;

                return (
                  <li key={item}>
                    <span className="legal-marker">{marker}</span>
                    <span>{content}</span>
                  </li>
                );
              })}
            </ol>
          );
        }

        return <p key={index}>{block.content}</p>;
      })}
    </div>
  );
}

function renderSingleBlock(block) {
  if (!block) {
    return null;
  }

  if (block.type === "heading") {
    if (block.level === 1) {
      return <h3>{block.content}</h3>;
    }

    if (block.level === 2) {
      return <h4>{block.content}</h4>;
    }

    return <h5>{block.content}</h5>;
  }

  if (block.type === "list") {
    return (
      <ul>
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }

  if (block.type === "ordered-list") {
    return (
      <ol className="legal-list">
        {block.items.map((item) => {
          const match = item.match(/^(\d+\))(.*)$/);
          const marker = match?.[1] ?? "";
          const content = match?.[2]?.trim() ?? item;

          return (
            <li key={item}>
              <span className="legal-marker">{marker}</span>
              <span>{content}</span>
            </li>
          );
        })}
      </ol>
    );
  }

  return <p>{block.content}</p>;
}

function ComparisonOrderedList({ currentBlock, proposedBlock }) {
  const currentItems = (currentBlock?.items ?? []).map((item) => {
    const match = item.match(/^(\d+\))(.*)$/);
    return {
      marker: match?.[1] ?? "",
      content: match?.[2]?.trim() ?? item,
    };
  });
  const proposedItems = (proposedBlock?.items ?? []).map((item) => {
    const match = item.match(/^(\d+\))(.*)$/);
    return {
      marker: match?.[1] ?? "",
      content: match?.[2]?.trim() ?? item,
    };
  });

  const dp = Array.from({ length: currentItems.length + 1 }, () =>
    Array(proposedItems.length + 1).fill(0),
  );

  for (let i = currentItems.length - 1; i >= 0; i -= 1) {
    for (let j = proposedItems.length - 1; j >= 0; j -= 1) {
      if (currentItems[i].content === proposedItems[j].content) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const rows = [];
  let i = 0;
  let j = 0;

  while (i < currentItems.length && j < proposedItems.length) {
    if (currentItems[i].content === proposedItems[j].content) {
      rows.push({
        currentItem: currentItems[i],
        proposedItem: proposedItems[j],
        changed: false,
      });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({
        currentItem: currentItems[i],
        proposedItem: null,
        changed: true,
      });
      i += 1;
    } else {
      rows.push({
        currentItem: null,
        proposedItem: proposedItems[j],
        changed: true,
      });
      j += 1;
    }
  }

  while (i < currentItems.length) {
    rows.push({
      currentItem: currentItems[i],
      proposedItem: null,
      changed: true,
    });
    i += 1;
  }

  while (j < proposedItems.length) {
    rows.push({
      currentItem: null,
      proposedItem: proposedItems[j],
      changed: true,
    });
    j += 1;
  }

  return (
    <div className="comparison-ordered-list">
      {rows.map((row, index) => {
        const currentItem = row.currentItem;
        const proposedItem = row.proposedItem;
        const changed = row.changed;

        return (
          <div
            key={`${currentItem?.marker ?? "none"}-${proposedItem?.marker ?? "none"}-${index}`}
            className="comparison-row comparison-row-tight"
          >
            <div
              className={
                changed && currentItem && proposedItem
                  ? "comparison-cell comparison-cell-changed"
                  : "comparison-cell"
              }
            >
              {currentItem ? (
                <div className="legal-list-item">
                  <span className="legal-marker">{currentItem.marker}</span>
                  <span>{currentItem.content}</span>
                </div>
              ) : (
                <div className="comparison-missing comparison-missing-inline">
                  Kohta poistettu voimassaolevasta laista.
                </div>
              )}
            </div>
            <div
              className={
                changed && currentItem && proposedItem
                  ? "comparison-cell comparison-cell-changed"
                  : "comparison-cell"
              }
            >
              {proposedItem ? (
                <div className="legal-list-item">
                  <span className="legal-marker">{proposedItem.marker}</span>
                  <span>{proposedItem.content}</span>
                </div>
              ) : (
                <div className="comparison-missing comparison-missing-inline">
                  Kohta poistettu lakiehdotuksesta.
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ComparisonBlocks({ currentMarkdown, proposedMarkdown }) {
  const currentBlocks = renderMarkdown(currentMarkdown);
  const proposedBlocks = renderMarkdown(proposedMarkdown);
  const count = Math.max(currentBlocks.length, proposedBlocks.length);

  return (
    <div className="comparison-blocks">
      {Array.from({ length: count }, (_, index) => {
        const currentBlock = currentBlocks[index];
        const proposedBlock = proposedBlocks[index];
        const currentText = JSON.stringify(currentBlock ?? null);
        const proposedText = JSON.stringify(proposedBlock ?? null);
        const changed = currentText !== proposedText;

        if (
          currentBlock?.type === "ordered-list" ||
          proposedBlock?.type === "ordered-list"
        ) {
          return (
            <ComparisonOrderedList
              key={`ordered-${index}`}
              currentBlock={currentBlock?.type === "ordered-list" ? currentBlock : null}
              proposedBlock={
                proposedBlock?.type === "ordered-list" ? proposedBlock : null
              }
            />
          );
        }

        return (
          <div
            key={`row-${index}`}
            className={
              changed
                ? "comparison-row comparison-row-changed"
                : "comparison-row"
            }
          >
            <div
              className={
                changed && currentBlock && proposedBlock
                  ? "comparison-cell comparison-cell-changed"
                  : "comparison-cell"
              }
            >
              {currentBlock ? (
                <div className="markdown-content">
                  {renderSingleBlock(currentBlock)}
                </div>
              ) : (
                <div className="comparison-missing comparison-missing-inline">
                  Sisalto puuttuu voimassaolevasta laista.
                </div>
              )}
            </div>
            <div
              className={
                changed && currentBlock && proposedBlock
                  ? "comparison-cell comparison-cell-changed"
                  : "comparison-cell"
              }
            >
              {proposedBlock ? (
                <div className="markdown-content">
                  {renderSingleBlock(proposedBlock)}
                </div>
              ) : (
                <div className="comparison-missing comparison-missing-inline">
                  Sisalto puuttuu lakiehdotuksesta.
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function splitSections(markdown) {
  const lines = markdown.split("\n");
  const sections = [];
  let currentSection = null;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (currentSection) {
        sections.push(currentSection);
      }

      currentSection = {
        chapter: line.slice(3).trim(),
        section: "",
        lines: [],
      };
      continue;
    }

    if (line.startsWith("### ")) {
      if (currentSection) {
        sections.push(currentSection);
      }

      currentSection = {
        chapter: currentSection?.chapter ?? "",
        section: line.slice(4).trim(),
        lines: [],
      };
      continue;
    }

    if (!currentSection) {
      continue;
    }

    currentSection.lines.push(line);
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  return sections
    .filter((section) => section.section)
    .map((section) => ({
      ...section,
      markdown: section.lines.join("\n").trim(),
      normalized: section.lines.join("\n").replace(/\s+/g, " ").trim(),
    }));
}

function ComparisonView({
  currentMarkdown,
  proposedMarkdown,
  showOnlyChanges,
  onToggleShowOnlyChanges,
}) {
  const currentSections = splitSections(currentMarkdown);
  const proposedSections = splitSections(proposedMarkdown);
  const currentBySection = new Map(
    currentSections.map((section) => [section.section, section]),
  );
  const proposedBySection = new Map(
    proposedSections.map((section) => [section.section, section]),
  );
  const orderedSectionNames = [
    ...currentSections.map((section) => section.section),
    ...proposedSections
      .map((section) => section.section)
      .filter((section) => !currentBySection.has(section)),
  ];

  const comparisonSections = orderedSectionNames.map((sectionName) => {
    const currentSection = currentBySection.get(sectionName);
    const proposedSection = proposedBySection.get(sectionName);
    const currentNormalized = currentSection?.normalized ?? "";
    const proposedNormalized = proposedSection?.normalized ?? "";

    return {
      chapter: currentSection?.chapter ?? proposedSection?.chapter ?? "",
      section: sectionName,
      changed: currentNormalized !== proposedNormalized,
      currentMarkdown: currentSection?.markdown ?? "",
      proposedMarkdown: proposedSection?.markdown ?? "",
    };
  });

  const visibleSections = showOnlyChanges
    ? comparisonSections.filter((section) => section.changed)
    : comparisonSections;

  return (
    <div className="comparison-view">
      <label className="comparison-toggle">
        <input
          type="checkbox"
          checked={showOnlyChanges}
          onChange={(event) => onToggleShowOnlyChanges(event.target.checked)}
        />
        <span>Nayta vain muutokset</span>
      </label>

      {visibleSections.length === 0 ? (
        <p className="comparison-empty">
          Lakitekstien valilla ei ole muutoksia nykyisella sisallolla.
        </p>
      ) : (
        visibleSections.map((section) => (
          <section
            key={section.section}
            className={
              section.changed
                ? "comparison-section changed"
                : "comparison-section"
            }
          >
            <p className="comparison-chapter">{section.chapter}</p>
            <h3>{section.section}</h3>
            <div className="comparison-headings">
              <h4>Voimassaoleva laki</h4>
              <h4>Lakiehdotus</h4>
            </div>
            <ComparisonBlocks
              currentMarkdown={section.currentMarkdown}
              proposedMarkdown={section.proposedMarkdown}
            />
          </section>
        ))
      )}
    </div>
  );
}

const tabs = [
  {
    id: "current-law",
    label: "Voimassaoleva laki",
    title: "Voimassaoleva laki",
    content: currentLawContent,
  },
  {
    id: "proposal",
    label: "Lakiehdotus",
    title: "Lakiehdotus",
    content: proposedLawContent,
  },
  {
    id: "comparison",
    label: "Vertailu",
    title: "Vertailu",
    content:
      "Tahan osioon voidaan lisata rinnakkainen vertailu voimassaolevan lain ja lakiehdotuksen valille.",
  },
  {
    id: "reasons",
    label: "Perustelut",
    title: "Perustelut",
    content:
      "Tahan osioon voidaan kirjoittaa aloitteen perustelut, tavoitteet ja vaikutukset kansalaisille, viranomaisille ja yhteiskunnalle.",
  },
];

function App() {
  const [activeTab, setActiveTab] = useState(tabs[0].id);
  const [showOnlyChanges, setShowOnlyChanges] = useState(false);
  const currentTab = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  return (
    <div className="page-shell">
      <main className="page-card">
        <p className="eyebrow">Kansalaisaloite</p>
        <h1>Rahankerayslain muuttaminen</h1>
        <p className="intro">
          Talle sivulle voidaan koota selkea kokonaisuus voimassaolevasta
          laista, ehdotetusta muutoksesta ja sen perusteluista.
        </p>

        <div
          className="tabs"
          role="tablist"
          aria-label="Lakialoitteen sisalto"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              id={`tab-${tab.id}`}
              className={activeTab === tab.id ? "tab active" : "tab"}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <section
          className="tab-panel"
          role="tabpanel"
          id={`panel-${currentTab.id}`}
          aria-labelledby={`tab-${currentTab.id}`}
        >
          <h2>{currentTab.title}</h2>
          {currentTab.id === "comparison" ? (
            <ComparisonView
              currentMarkdown={currentLawContent}
              proposedMarkdown={proposedLawContent}
              showOnlyChanges={showOnlyChanges}
              onToggleShowOnlyChanges={setShowOnlyChanges}
            />
          ) : (
            <MarkdownContent markdown={currentTab.content} />
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
