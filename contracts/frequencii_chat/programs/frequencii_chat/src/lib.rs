use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::{ephemeral};
use ephemeral_rollups_sdk::cpi::{DelegateAccounts, delegate_account, DelegateConfig, undelegate_account};

declare_id!("GW1UhbCFrpZVWgjQHY55poLodode4FSpm1ZsNK7ndf4f");

#[ephemeral]
#[program]
pub mod frequencii_chat {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let chat_room = &mut ctx.accounts.chat_room;
        chat_room.message_count = 0;
        Ok(())
    }

    pub fn send_message(ctx: Context<SendMessage>, content: String) -> Result<()> {
        let chat_room = &mut ctx.accounts.chat_room;
        chat_room.message_count += 1;

        emit!(MessageSent {
            sender: ctx.accounts.user.key(),
            content,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    pub fn delegate_chat(ctx: Context<DelegateChat>) -> Result<()> {
        let pda_seeds: &[&[u8]] = &[b"chat", ctx.accounts.user.key.as_ref()];

        let accounts = DelegateAccounts {
            payer: &ctx.accounts.user.to_account_info(),
            pda: &ctx.accounts.chat_room.to_account_info(),
            owner_program: &ctx.accounts.program.to_account_info(),
            buffer: &ctx.accounts.buffer.to_account_info(),
            delegation_record: &ctx.accounts.delegation_record.to_account_info(),
            delegation_metadata: &ctx.accounts.delegation_metadata.to_account_info(),
            delegation_program: &ctx.accounts.magic_program.to_account_info(),
            system_program: &ctx.accounts.system_program.to_account_info(),
        };

        let config = DelegateConfig::default();
        delegate_account(accounts, pda_seeds, config)?;
        Ok(())
    }

    pub fn undelegate_chat(ctx: Context<UndelegateChat>) -> Result<()> {
        let pda_seeds: &[&[u8]] = &[b"chat", ctx.accounts.user.key.as_ref()];
        let pda_seeds_vec: Vec<Vec<u8>> = pda_seeds.iter().map(|s| s.to_vec()).collect();

        undelegate_account(
            &ctx.accounts.chat_room.to_account_info(),
            &ctx.program_id,
            &ctx.accounts.buffer.to_account_info(),
            &ctx.accounts.user.to_account_info(),
            &ctx.accounts.system_program.to_account_info(),
            pda_seeds_vec,
        )?;
       Ok(())
    }
}

#[account]
pub struct ChatRoom {
    pub message_count: u64,
}

#[event]
pub struct MessageSent {
    pub sender: Pubkey,
    pub content: String,
    pub timestamp: i64,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + 8 + 32,
        seeds = [b"chat", user.key().as_ref()],
        bump
    )]
    pub chat_room: Account<'info, ChatRoom>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SendMessage<'info> {
    #[account(
        mut,
        seeds = [b"chat", user.key().as_ref()],
        bump
    )]
    pub chat_room: Account<'info, ChatRoom>,
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct DelegateChat<'info> {
    #[account(
        mut,
        seeds = [b"chat", user.key().as_ref()],
        bump
    )]
    pub chat_room: Account<'info, ChatRoom>,
    #[account(mut)]
    pub user: Signer<'info>,
    /// CHECK: Delegated Buffer PDA
    #[account(mut)]
    pub buffer: AccountInfo<'info>,
    /// CHECK: Delegation Record PDA
    #[account(mut)]
    pub delegation_record: AccountInfo<'info>,
    /// CHECK: Delegation Metadata PDA
    #[account(mut)]
    pub delegation_metadata: AccountInfo<'info>,
    /// CHECK: MagicBlock Program
    pub magic_program: AccountInfo<'info>,
    /// CHECK: This program
    #[account(address = crate::ID)]
    pub program: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UndelegateChat<'info> {
    #[account(
        mut,
        seeds = [b"chat", user.key().as_ref()],
        bump
    )]
    pub chat_room: Account<'info, ChatRoom>,
    #[account(mut)]
    pub user: Signer<'info>,
    /// CHECK: Delegated Buffer PDA
    #[account(mut)]
    pub buffer: AccountInfo<'info>,
    /// CHECK: MagicBlock Program
    pub magic_program: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}
