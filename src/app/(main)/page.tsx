"use client";

import {
  Heading,
  Text,
  Button,
  Column,
  Badge,
  LetterFx,
} from "@once-ui-system/core";

export default function Home() {
  return (
    <Column fillWidth center padding="l" style={{ minHeight: "100vh" }}>
      <Column maxWidth="s" horizontal="center" gap="l" align="center">
        <Badge
          textVariant="code-default-s"
          border="neutral-alpha-medium"
          onBackground="neutral-medium"
          vertical="center"
          gap="16"
        >
          <Text marginX="4">
            <LetterFx trigger="instant">frequencii.world</LetterFx>
          </Text>
        </Badge>
        <Heading variant="display-strong-xl" marginTop="24">
          Connect on Your Frequency
        </Heading>
        <Text
          variant="heading-default-xl"
          onBackground="neutral-weak"
          wrap="balance"
          marginBottom="16"
        >
          Unstoppable, serverless messaging powered by Solana. Chat freely, pay instantly.
        </Text>
        <Button
          id="chat"
          href="/chat"
          data-border="rounded"
          weight="default"
          prefixIcon="message"
          arrowIcon
        >
          Start Chat
        </Button>
      </Column>
    </Column>
  );
}
