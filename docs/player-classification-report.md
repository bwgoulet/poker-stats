# All-time player classification report

This report was generated from all four season workbooks in `data/` after applying the classification boundaries in `src/lib/stats/player-classification.ts`. It includes every player with at least five comparable (non-one-off) nights. Percentiles are ranks within this 20-player eligible field; rates and swings are shown to three decimal places.

| Player | Type | Exposure percentile | Median buy-ins | Multi-buy-in rate | Swing percentile | Outcome swing (buy-ins) |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Aidan Pirc | Action Player | 100.000 | 2.000 | 0.824 | 23.684 | 1.483 |
| Aiden | Gambler | 0.000 | 1.000 | 0.231 | 78.947 | 2.268 |
| Ben | Neutral | 68.421 | 2.000 | 0.657 | 57.895 | 2.043 |
| Calen | Maniac | 84.211 | 2.000 | 0.727 | 89.474 | 2.765 |
| Cam | Neutral | 5.263 | 1.000 | 0.263 | 10.526 | 1.257 |
| Chris | Neutral | 10.526 | 1.000 | 0.318 | 36.842 | 1.646 |
| Chris S | Neutral | 15.789 | 1.000 | 0.333 | 52.632 | 2.024 |
| Drew | Action Player | 89.474 | 2.000 | 0.735 | 68.421 | 2.061 |
| Favor | Maniac | 78.947 | 2.000 | 0.600 | 84.211 | 2.317 |
| Jack | Steady | 31.579 | 1.000 | 0.421 | 0.000 | 0.667 |
| Jake | Neutral | 42.105 | 1.000 | 0.483 | 15.789 | 1.260 |
| Mason | Neutral | 57.895 | 1.500 | 0.538 | 42.105 | 1.661 |
| Matthew | Steady | 52.632 | 1.500 | 0.500 | 5.263 | 0.741 |
| Max | Neutral | 26.316 | 1.000 | 0.406 | 63.158 | 2.053 |
| Owen | Gambler | 36.842 | 1.000 | 0.462 | 100.000 | 5.041 |
| Raghav | Neutral | 47.368 | 1.250 | 0.500 | 47.368 | 1.761 |
| Stone | Neutral | 73.684 | 2.000 | 0.733 | 31.579 | 1.631 |
| Tim | Maniac | 94.737 | 2.000 | 0.758 | 94.737 | 3.017 |
| William | Neutral | 21.053 | 1.000 | 0.385 | 73.684 | 2.128 |
| Zimmy | Neutral | 63.158 | 2.000 | 0.571 | 23.684 | 1.483 |

## Validation observations

The resulting distribution contains no NIT, which is consistent with applying every practical gate rather than tuning the criteria to produce that label:

- Aiden meets every low-exposure gate, but both his swing percentile and raw outcome swing are high, so he is a Gambler.
- Cam falls in the bottom third on both percentile dimensions, but his 0.263 multi-buy-in rate exceeds one quarter and his 1.257-buy-in outcome swing exceeds one buy-in, so he is Neutral.
- Jack meets both low-swing gates, but his 0.421 multi-buy-in rate exceeds one quarter, so he remains Steady rather than becoming a NIT.
- Matthew also meets both low-swing gates, but his exposure percentile and multi-buy-in rate are outside the low-exposure boundaries, so he remains Steady.

These cases validate that the percentile and raw-value gates work together and that frequent rebuys prevent a low-swing player from receiving the NIT label.
