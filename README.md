# Tokanu Moda — site de loja de moda

Loja de moda feminina e masculina (roupas, calçados, bolsas, relógios, óculos e bijuterias).
Vitrine estática (HTML/CSS/JS puro) no GitHub Pages; o pedido é finalizado no WhatsApp.
Criado a partir da estrutura do site Elysanya v2, **sem nenhum vínculo** com o repositório dela.
Site feito por Tokanu · João Marcos Alves.

## Endereços
- Site: https://joaoal15.github.io/site-moda-loja-/
- Painel: https://joaoal15.github.io/site-moda-loja-/admin.html
- Repositório: https://github.com/joaoAl15/site-moda-loja-

## Onde fica cada coisa
- `assets/js/config.js` — nome da loja, WhatsApp, Instagram, cidade, mensagens prontas e repositório
- `data/produtos.json` — categorias e produtos (vazio: o site mostra a "vitrine de exemplo")
- `assets/logo/` — logo da Tokanu (ícone, selo redondo, logos horizontais, imagem de compartilhamento)
- `assets/hero/` — sacolinhas em SVG usadas nas animações
- `assets/produtos/` — fotos enviadas pelo painel

## Personalizar para uma cliente
1. Troque os dados em `assets/js/config.js` (nome, WhatsApp, Instagram, cidade, repositório).
2. Troque as imagens de `assets/logo/` pela logo dela (mesmos nomes de arquivo).
3. Ajuste as cores no topo de `assets/css/style.css` (variáveis `--rose`, `--blush`, `--cocoa`…).
4. Cadastre os produtos pelo painel.

## Ao alterar CSS ou JS
Aumente o número `?v=` nos links de `index.html`, `privacidade.html` e `admin.html` para os visitantes não ficarem com a versão antiga em cache.
