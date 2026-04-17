import React, { useState, useEffect, useCallback } from "react";
import {
  Column,
  Row,
  Text,
  Input,
  Button,
  Scroller,
} from "@once-ui-system/core";
import type { PredictionEvent, MarketCategory } from "@/lib/types";
import { MarketCard } from "./MarketCard";

const CATEGORIES: MarketCategory[] = [
  "All",
  "crypto",
  "politics",
  "sports",
  "economics",
  "culture",
  "mentions",
];

const CATEGORY_LABELS: Record<MarketCategory, string> = {
  All: "All",
  crypto: "Crypto",
  politics: "Politics",
  sports: "Sports",
  economics: "Economics",
  culture: "Culture",
  mentions: "Trending",
};

interface MarketBrowserProps {
  isMobile: boolean;
  markets: PredictionEvent[];
  selectedMarket: PredictionEvent | null;
  isLoading: boolean;
  hasMore: boolean;
  onSelectMarket: (market: PredictionEvent) => void;
  onCategoryChange: (cat: MarketCategory) => void;
  onSearchChange: (search: string) => void;
  onRefresh: () => void;
  onLoadMore: () => void;
  activeCategory: MarketCategory;
}

export const MarketBrowser: React.FC<MarketBrowserProps> = ({
  isMobile,
  markets,
  selectedMarket,
  isLoading,
  hasMore,
  onSelectMarket,
  onCategoryChange,
  onSearchChange,
  onRefresh,
  onLoadMore,
  activeCategory,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(
    null
  );

  const handleSearchInput = useCallback(
    (value: string) => {
      setSearchQuery(value);

      // Debounce search
      if (debounceTimer) clearTimeout(debounceTimer);
      const timer = setTimeout(() => {
        onSearchChange(value);
      }, 400);
      setDebounceTimer(timer);
    },
    [debounceTimer, onSearchChange]
  );

  useEffect(() => {
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [debounceTimer]);

  return (
    <Column
      fillWidth={isMobile}
      style={{
        overflow: "hidden",
        minHeight: 0,
      }}
      border="neutral-alpha-medium"
      radius="l"
      background="neutral-weak"
      padding="s"
      gap="xs"
      fillHeight
    >
      <Row fillWidth vertical="center" style={{ justifyContent: "space-between" }}>
        <Text variant="heading-strong-s" padding="s">
          Markets
        </Text>
        <Button
          variant="tertiary"
          size="s"
          onClick={onRefresh}
          loading={isLoading}
        >
          {isLoading ? "" : "Refresh"}
        </Button>
      </Row>

      {/* Search */}
      <Column paddingX="xs" paddingBottom="xs">
        <Input
          id="market-search"
          value={searchQuery}
          onChange={(e) => handleSearchInput(e.target.value)}
          placeholder="Search markets..."
          height="s"
        />
      </Column>

      {/* Category tabs */}
      <Scroller fillWidth direction="row">
        <Row gap="2" paddingX="xs" paddingBottom="xs">
          {CATEGORIES.map((cat) => (
            <Button
              key={cat}
              variant={activeCategory === cat ? "primary" : "tertiary"}
              size="s"
              onClick={() => onCategoryChange(cat)}
              style={{ whiteSpace: "nowrap" }}
            >
              {CATEGORY_LABELS[cat]}
            </Button>
          ))}
        </Row>
      </Scroller>

      {/* Market list */}
      <Scroller fillWidth style={{ flex: 1, minHeight: 0 }}>
        <Column gap="4" fillWidth>
          {isLoading && markets.length === 0 ? (
            <Column padding="l" center>
              <Text variant="body-default-s" onBackground="neutral-weak">
                Loading markets...
              </Text>
            </Column>
          ) : markets.length === 0 ? (
            <Column padding="l" center>
              <Text variant="body-default-s" onBackground="neutral-weak">
                No markets found
              </Text>
            </Column>
          ) : (
            markets.map((event) => (
              <MarketCard
                key={event.id}
                event={event}
                isSelected={selectedMarket?.id === event.id}
                onClick={() => onSelectMarket(event)}
              />
            ))
          )}
          {hasMore && (
            <Column padding="s" center>
              <Button
                variant="tertiary"
                size="s"
                onClick={onLoadMore}
                loading={isLoading}
                fillWidth
              >
                Load More
              </Button>
            </Column>
          )}
        </Column>
      </Scroller>
    </Column>
  );
};
