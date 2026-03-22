"""
solana_views.py — Endpoints publics Solana/NFT
  GET  /api/solana/tokenomics/          — distribution schedule + burn méchanismes
  POST /api/solana/verify-ownership/    — vérifier propriété NFT on-chain
  GET  /api/solana/spl-token/           — infos token HEX SPL
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated


class TokenomicsView(APIView):
    permission_classes = [AllowAny]
    def get(self, request):
        from terra_domini.apps.blockchain.solana_devnet import TOKENOMICS
        return Response(TOKENOMICS)


class VerifyNFTOwnershipView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        mint_address   = request.data.get('mint_address', '')
        wallet_address = request.data.get('wallet_address') or getattr(request.user, 'wallet_address', '')
        if not mint_address:
            return Response({'error': 'mint_address required'}, status=400)
        from terra_domini.apps.blockchain.solana_devnet import verify_nft_ownership
        owns = verify_nft_ownership(mint_address, wallet_address)
        return Response({'owns': owns, 'mint_address': mint_address, 'wallet': wallet_address})


class SPLTokenInfoView(APIView):
    permission_classes = [AllowAny]
    def get(self, request):
        from terra_domini.apps.blockchain.solana_devnet import (
            HEX_TOKEN_NAME, HEX_TOKEN_SYMBOL, HEX_TOKEN_DECIMALS,
            HEX_TOKEN_SUPPLY, HEXOD_ENV, SOLANA_RPC, mock_create_spl_token,
        )
        info = mock_create_spl_token()
        info['network'] = 'devnet' if HEXOD_ENV != 'production' else 'mainnet'
        info['rpc'] = SOLANA_RPC
        return Response(info)
