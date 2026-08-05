# Graph Report - performance-main  (2026-05-02)

## Corpus Check
- 2 files · ~1,048,900 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 18 nodes · 21 edges · 3 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]

## God Nodes (most connected - your core abstractions)
1. `generateFeedbackHTML()` - 3 edges
2. `openModal()` - 3 edges
3. `animateCounter()` - 2 edges
4. `buildNarrative()` - 2 edges
5. `formatNumber()` - 2 edges
6. `updateSummaryMetrics()` - 2 edges
7. `createCustomLegend()` - 2 edges
8. `renderChart()` - 2 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities

### Community 1 - "Community 1"
Cohesion: 0.5
Nodes (4): buildNarrative(), formatNumber(), generateFeedbackHTML(), openModal()

### Community 2 - "Community 2"
Cohesion: 1.0
Nodes (2): animateCounter(), updateSummaryMetrics()

### Community 3 - "Community 3"
Cohesion: 1.0
Nodes (2): createCustomLegend(), renderChart()

## Knowledge Gaps
- **Thin community `Community 2`** (2 nodes): `animateCounter()`, `updateSummaryMetrics()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 3`** (2 nodes): `createCustomLegend()`, `renderChart()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `generateFeedbackHTML()` connect `Community 1` to `Community 0`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **Why does `openModal()` connect `Community 1` to `Community 0`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._