# All-time player classification report

This report was generated from all four season workbooks in `data/` after applying the classification boundaries in `src/lib/stats/player-classification.ts`. It includes every player with at least five comparable (non-one-off) nights. Percentiles are ranks within this 20-player eligible field; rates and swings are shown to three decimal places.

| Player | Type | Exposure percentile | Median buy-ins | Multi-buy-in rate | Swing percentile | Outcome swing (buy-ins) |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Aidan Pirc | Whale | 100.000 | 2.000 | 0.824 | 23.684 | 1.483 |
| Aiden | Gambler | 0.000 | 1.000 | 0.231 | 78.947 | 2.268 |
| Ben | Neutral | 68.421 | 2.000 | 0.657 | 57.895 | 2.043 |
| Calen | Maniac | 84.211 | 2.000 | 0.727 | 89.474 | 2.765 |
| Cam | NIT | 5.263 | 1.000 | 0.263 | 10.526 | 1.257 |
| Chris | One-Bullet | 10.526 | 1.000 | 0.318 | 36.842 | 1.646 |
| Chris S | One-Bullet | 15.789 | 1.000 | 0.333 | 52.632 | 2.024 |
| Drew | Action Player | 89.474 | 2.000 | 0.735 | 68.421 | 2.061 |
| Favor | Maniac | 78.947 | 2.000 | 0.600 | 84.211 | 2.317 |
| Jack | Steady | 31.579 | 1.000 | 0.421 | 0.000 | 0.667 |
| Jake | Steady | 42.105 | 1.000 | 0.483 | 15.789 | 1.260 |
| Mason | Neutral | 57.895 | 1.500 | 0.538 | 42.105 | 1.661 |
| Matthew | Steady | 52.632 | 1.500 | 0.500 | 5.263 | 0.741 |
| Max | Neutral | 26.316 | 1.000 | 0.406 | 63.158 | 2.053 |
| Owen | Chemical X | 36.842 | 1.000 | 0.462 | 100.000 | 5.041 |
| Raghav | Neutral | 47.368 | 1.250 | 0.500 | 47.368 | 1.761 |
| Stone | Neutral | 73.684 | 2.000 | 0.733 | 31.579 | 1.631 |
| Tim | Maniac | 94.737 | 2.000 | 0.758 | 94.737 | 3.017 |
| William | One-Bullet | 21.053 | 1.000 | 0.385 | 73.684 | 2.128 |
| Zimmy | Steady | 63.158 | 2.000 | 0.571 | 23.684 | 1.483 |

## Validation observations

All nine combinations of low, middle, and high buy-in intensity and outcome swing are represented:

- Aiden is a Gambler because his buy-in intensity is low and his outcome swing is high; Owen is Chemical X because his buy-in intensity is in the middle while his outcome swing is high.
- Aidan Pirc is a Whale because his buy-in intensity is high and his outcome swing is low; Drew is an Action Player because his buy-in intensity is high while his outcome swing is in the middle.
- Cam is a NIT because both dimensions are low, while Calen, Favor, and Tim are Maniacs because both dimensions are high.

Each player type now maps to exactly one cell in the three-by-three classification matrix.
