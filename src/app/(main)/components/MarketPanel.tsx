import React, { useState } from "react";
import { Column, Row, Text, Button, Scroller } from "@once-ui-system/core";
import type {
    PredictionEvent,
    MarketCategory,
    TradeOutcome,
    TradeStep,
    Position,
} from "@/lib/types";
import { MarketBrowser } from "./MarketBrowser";
import { MarketDetail } from "./MarketDetail";
import { TradePanel } from "./TradePanel";
import { PortfolioView } from "./PortfolioView";
import { PrivateWalletSetup } from "./PrivateWalletSetup";

type PanelView = "browse" | "detail" | "trade" | "portfolio";
interface MarketPanelProps {
    visible: boolean;
    isMobile: boolean;
    // Market data
    markets: PredictionEvent[];
    selectedMarket: PredictionEvent | null;
    isLoadingMarkets: boolean;
    hasMoreMarkets: boolean;
    activeCategory: MarketCategory;
    onSelectMarket: (market: PredictionEvent | null) => void;
    onCategoryChange: (cat: MarketCategory) => void;
    onSearchChange: (search: string) => void;
    onRefreshMarkets: () => void;
    onLoadMoreMarkets: () => void;
    // Burner wallet
    burnerIsSetup: boolean;
    burnerIsUnlocked: boolean;
    burnerPublicKey: string | null;
    burnerBalanceSol: number;
    burnerStep: string;
    burnerStepMessage: string;
    burnerError: string | null;
    privacyCashSigned: boolean;
    onSetupBurner: () => Promise<any>;
    onUnlockBurner: () => Promise<any>;
    onFundBurner: (amount: number) => Promise<any>;
    onResetBurner: () => void;
    // Trade
    tradeStep: TradeStep;
    tradeMessage: string;
    tradeError: string | null;
    isTrading: boolean;
    onTrade: (marketId: string, outcome: TradeOutcome, amount: number) => Promise<any>;
    onResetTrade: () => void;
    // Portfolio
    positions: Position[];
    isLoadingPositions: boolean;
    onRefreshPositions: () => void;
    onClaimPayout: (positionId: string) => Promise<any>;
    // Panel control
    onClose?: () => void;
}

export const MarketPanel: React.FC<MarketPanelProps> = ({
    visible,
    isMobile,
    markets,
    selectedMarket,
    isLoadingMarkets,
    hasMoreMarkets,
    activeCategory,
    onSelectMarket,
    onCategoryChange,
    onSearchChange,
    onRefreshMarkets,
    onLoadMoreMarkets,
    burnerIsSetup,
    burnerIsUnlocked,
    burnerPublicKey,
    burnerBalanceSol,
    burnerStep,
    burnerStepMessage,
    burnerError,
    privacyCashSigned,
    onSetupBurner,
    onUnlockBurner,
    onFundBurner,
    onResetBurner,
    tradeStep,
    tradeMessage,
    tradeError,
    isTrading,
    onTrade,
    onResetTrade,
    positions,
    isLoadingPositions,
    onRefreshPositions,
    onClaimPayout,
    onClose,
}) => {
    const [panelView, setPanelView] = useState<PanelView>("browse");

    if (!visible) return null;

    // Render appropriate sub-panel
    const renderContent = () => {
        if (panelView === "portfolio") {
            return (
                <Column fillWidth fillHeight gap="s" style={{ overflowY: 'auto' }}>
                    <PrivateWalletSetup
                        isSetup={burnerIsSetup}
                        isUnlocked={burnerIsUnlocked}
                        publicKey={burnerPublicKey}
                        balanceSol={burnerBalanceSol}
                        step={burnerStep as any}
                        stepMessage={burnerStepMessage}
                        error={burnerError}
                        privacyCashSigned={privacyCashSigned}
                        onSetup={onSetupBurner}
                        onUnlock={onUnlockBurner}
                        onFund={onFundBurner}
                        onReset={onResetBurner}
                    />
                    <PortfolioView
                        positions={positions}
                        isLoading={isLoadingPositions}
                        isTrading={isTrading}
                        onRefresh={onRefreshPositions}
                        onClaim={onClaimPayout}
                    />
                </Column>
            );
        }

        if (panelView === "trade" && selectedMarket) {
            return (
                <TradePanel
                    event={selectedMarket}
                    burnerBalanceSol={burnerBalanceSol}
                    isUnlocked={burnerIsUnlocked}
                    tradeStep={tradeStep}
                    tradeMessage={tradeMessage}
                    tradeError={tradeError}
                    isTrading={isTrading}
                    onTrade={onTrade}
                    onReset={onResetTrade}
                    onClose={() => setPanelView("detail")}
                />
            );
        }

        if (panelView === "detail" && selectedMarket) {
            return (
                <MarketDetail
                    event={selectedMarket}
                    onClose={() => {
                        setPanelView("browse");
                        onSelectMarket(null);
                    }}
                    onTrade={() => setPanelView("trade")}
                    isUnlocked={burnerIsUnlocked}
                />
            );
        }

        // Default: market browser
        return (
            <MarketBrowser
                isMobile={false}
                markets={markets}
                selectedMarket={selectedMarket}
                isLoading={isLoadingMarkets}
                hasMore={hasMoreMarkets}
                onSelectMarket={(market) => {
                    onSelectMarket(market);
                    setPanelView("detail");
                }}
                onCategoryChange={onCategoryChange}
                onSearchChange={onSearchChange}
                onRefresh={onRefreshMarkets}
                onLoadMore={onLoadMoreMarkets}
                activeCategory={activeCategory}
            />
        );
    };

    return (
        <Column
            fillWidth={isMobile}
            style={
                isMobile
                    ? {
                        position: 'fixed',
                        top: 0,
                        right: 0,
                        bottom: 0,
                        width: '100%',
                        zIndex: 100,
                        backgroundColor: 'var(--surface-background)',
                    }
                    : { maxWidth: '360px', minWidth: '360px' }
            }
            fillHeight
            gap="xs"
        >
            {/* Panel navigation tabs */}
            <Row
                fillWidth
                gap="2"
                padding="xs"
                background="neutral-weak"
                radius="l"
                border="neutral-alpha-medium"
            >
                <Button
                    fillWidth
                    variant={panelView === "browse" || panelView === "detail" || panelView === "trade" ? "primary" : "tertiary"}
                    size="s"
                    onClick={() => {
                        setPanelView("browse");
                        onSelectMarket(null);
                    }}
                >
                    Markets
                </Button>
                <Button
                    fillWidth
                    variant={panelView === "portfolio" ? "primary" : "tertiary"}
                    size="s"
                    onClick={() => {
                        setPanelView("portfolio");
                        onSelectMarket(null);
                    }}
                >
                    Portfolio
                </Button>

                {isMobile && onClose && (
                    <Button variant="tertiary" size="s" onClick={onClose}>
                        Close
                    </Button>
                )}
            </Row>

            {/* Panel content */}
            <Column fillWidth fillHeight>
                {renderContent()}
            </Column>
        </Column>
    );
};
