import React, { useState } from "react";
import {
    Flex,
    Column,
    Row,
    Text,
    Button,
    Input,
} from "@once-ui-system/core";
import { contactSchema } from "../utils";

interface AddContactModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (address: string) => void;
}

export const AddContactModal: React.FC<AddContactModalProps> = ({ isOpen, onClose, onAdd }) => {
    const [newContactAddress, setNewContactAddress] = useState("");
    const [addContactError, setAddContactError] = useState("");

    const handleAddContact = () => {
        const result = contactSchema.safeParse(newContactAddress);

        if (!result.success) {
            setAddContactError(result.error.issues[0].message);
            return;
        }

        onAdd(newContactAddress);
        setNewContactAddress("");
        setAddContactError("");
    };

    if (!isOpen) return null;

    return (
        <Flex
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                zIndex: 1000,
                backdropFilter: 'blur(4px)',
            }}
            center
            vertical="center"
            horizontal="center"
        >
            <Column
                background="surface"
                padding="l"
                radius="l"
                border="neutral-alpha-weak"
                gap="l"
                style={{ width: '400px', maxWidth: '90vw' }}
            >
                <Text variant="heading-strong-m">Add New Contact</Text>

                <Column gap="s">
                    <Input
                        id="contact-address"
                        value={newContactAddress}
                        onChange={(e) => {
                            const value = e.target.value;
                            setNewContactAddress(value);
                            const result = contactSchema.safeParse(value);
                            if (!result.success) {
                                setAddContactError(result.error.issues[0].message);
                            } else {
                                setAddContactError("");
                            }
                        }}
                        placeholder="Enter wallet address..."
                    />
                    {addContactError && (
                        <Text variant="label-default-s" onBackground="danger-weak" style={{ color: 'var(--danger-on-background-weak)' }}>
                            {addContactError}
                        </Text>
                    )}
                </Column>

                <Row gap="s" style={{ justifyContent: 'flex-end' }}>
                    <Button variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={handleAddContact} disabled={!newContactAddress.trim()}>
                        Add Contact
                    </Button>
                </Row>
            </Column>
        </Flex>
    );
};
