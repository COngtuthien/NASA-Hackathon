# 07 — Mô hình hiện có & tài liệu nghiên cứu

> **Phương pháp:** (1) Đọc các mô hình/công thức/tương quan nằm trong tài liệu của repo; (2) đọc danh sách công bố trong 3 file ISA-Tab (FLEX 51, BASS-II 17, SAFFIRE-I 6 công bố) và FAQ/Appendix E; (3) tìm kiếm web (11/2026) cho mã nguồn mở và mô hình pretrained trên FLEX/BASS-II/SAFFIRE-I.
> **Nguyên tắc:** không gọi một mô hình là "pretrained" nếu không thấy checkpoint công khai hoặc bằng chứng huấn luyện đáng tin cậy.

---

## 1. Kết luận chính

1. **Không tìm thấy mô hình pretrained nào** (checkpoint công khai) được huấn luyện trên dữ liệu FLEX, BASS-II hoặc SAFFIRE-I.
2. **Không tìm thấy repository mã nguồn mở** nào kết hợp ML với ba bộ dữ liệu này.
3. Tri thức "mô hình" phong phú nhất là **mô hình vật lý / tương quan bán thực nghiệm** đã có trong tài liệu repo — đây là baseline mạnh và dễ giải thích hơn ML.
4. Có một số công trình **data-driven/hybrid** liên quan (data assimilation cho flame spread và droplet combustion; segmentation ảnh giọt bằng SAM 2) — dùng làm cảm hứng phương pháp, không phải mô hình tái sử dụng trực tiếp.

---

## 2. Mô hình & tương quan trong tài liệu của repo

| # | Mô hình / tương quan | Dạng | Áp dụng cho | Nguồn trong repo | Dùng được trong hackathon? |
|---|---|---|---|---|---|
| M1 | **d²-law**: (D/D0)² = 1 − K·t/D0² | Giải tích | FLEX burning rate, burn time | `2G11` tr.2 | ✅ Baseline vật lý, kiểm tra chất lượng (đã kiểm: median tỷ số 1.04) |
| M2 | **LOI = 0.209 (1 − MEC)**; bảng MEC cup-burner (CO2 0.16/0.19, He 0.27/0.31, N2 0.26/0.38 cho 1g/µg) | Tương quan | Hiệu quả chất ức chế | `FLEX_Test_Plan.pdf` tr.2–3 (trích Takahashi et al. 2004) | ✅ Giải thích; ⚠️ dữ liệu cup burner methane, không phải giọt |
| M3 | Flammability map dựa trên **Damköhler** tới hạn: nhánh extinction (Law 1975) + nhánh radiative quench (Chao et al. 1990); LOI = giao điểm | Khái niệm | FLEX | Test Plan tr.2, Hình 2; RRD | ✅ Trực quan hóa bản đồ D0–XO2 |
| M4 | Lý thuyết **de tuyến tính theo d0** cho methanol (Zhang, Card & Williams 1996) | Giải tích | FLEX methanol | `20130010979.pdf` tr.11 | ✅ Hồi quy so sánh (r = 0.66 trong CSV) |
| M5 | **Activation-energy asymptotics** cho extinction methanol (Nayagam et al., C&F 2013) | Tiệm cận | FLEX methanol | Chỉ tiêu đề/DOI trong metadata FLEX [6] (10.1016/j.combustflame.2013.05.011) | ⚠️ Cần đọc bài gốc |
| M6 | **Mô hình sphero-symmetric chuyển tiếp** với động học chi tiết (128 loài/565 phản ứng), bức xạ phổ, vận chuyển đa thành phần — Farouk & Dryer | CFD 1-D | FLEX heptane cool flame | `1G17` tr.3–5 | ❌ Mã không công khai, quá nặng; dùng làm nguồn giải thích |
| M7 | Lý thuyết cool flame giai đoạn 2 (Nayagam et al., "Can cool flames support quasi-steady alkane droplet burning?", C&F 2012) | Tiệm cận | FLEX heptane | `1G17` ref [11]; metadata [33] | ⚠️ Chỉ tham chiếu |
| M8 | **Vg,cr ~ (εσ/cg ρg)(Tv⁴ − T∞⁴)/(Tf − Tv)** — vận tốc opposed tới hạn cho radiative extinction | Phân tích thang đo | BASS-II màng PMMA | SR p.36, Table 2.1 | ✅ Tính lại được, so với 10 ± 5 / 30 ± 5 mm/s |
| M9 | Công thức spread rate màng mỏng de Ris, **F = 4.76**; **độ dày chuyển tiếp ≈ 5.2 mm** (PMMA, không khí) | Bán thực nghiệm | BASS-II | SR p.51–52 | ✅ |
| M10 | **Critical Damköhler + Nusselt + cân bằng năng lượng bề mặt hai vùng** cho thanh PMMA; đường cong biên flammability (hàm mũ + tuyến tính) | Bán thực nghiệm | BASS-II thanh PMMA | SR p.72, p.97–98, Hình 6.9–6.22 | ⚠️ Tham số trong báo cáo, cần chép lại |
| M11 | **Huggett O2 consumption calorimetry**: 13.1 kJ/g O2 | Hằng số | HRR BASS-II | SR p.16 | ⚠️ Cần burn time (chỉ có trong Table 5.1 cho Miller) |
| M12 | **CSTR dilution model** cho MSG 250 L | ODE | BASS-II vận hành | SR p.14, App. B (p.123–125) | ✅ Minh họa |
| M13 | Global equivalence ratio từ khối lượng mất và O2 tiêu thụ (0.4582 vol% O2/g) | Cân bằng khối lượng | BASS-II | SR p.18–19 | ✅ Giải thích |
| M14 | Mô hình số 2-D (NIST FDS/Smokeview) cho tấm PMMA dày — dự đoán spread rate cao hơn thực nghiệm | CFD | BASS-II Miller | SR p.68–71 | ❌ Nặng |
| M15 | Phân tích ảnh tự động cho ảnh giọt liên tiếp (Dembia, Liu, Avedisian, *Image Anal. Stereol.* 31, 2012) | Xử lý ảnh | FLEX | Metadata FLEX [29]; `2G11` tr.5 | ⚠️ Mã không thấy công khai |

---

## 3. Kết quả tìm kiếm web (đã kiểm tra 11/2026)

| Công trình | Liên quan | Dữ liệu huấn luyện/kiểm tra | Mã / trọng số | Phân loại |
|---|---|---|---|---|
| **SAM 2 + automatic prompt selection để đo đường kính ngọn lửa giọt trong ảnh vi trọng lực** — Xu, Zhou, Cecil, Liu, Huang, Xu, arXiv:2607.16587 (7/2026). Báo cáo MAPE 3.1 %, nhanh hơn đo thủ công ~229 lần, vượt Hough circle | Đo Df từ ảnh — hữu ích nếu tải ảnh FLEX | 19,537 ảnh n-heptane/n-decane/n-octane; trang arXiv **không nêu** đó là FLEX/CIR | Không xác nhận được việc phát hành mã/trọng số | **Published method, weights not verified** |
| **Segment Anything Model 2 (SAM 2)** (Meta) — mô hình nền tảng segmentation | Có thể segment ngọn lửa/giọt trong ảnh SAFFIRE/FLEX | Dữ liệu tổng quát, không phải cháy | Trọng số công khai | **Relevant model trained on different data** |
| **Data driven forecast of concurrent flame spread in micro-gravity** — X. Xi, J.L. Torero, A. Guibaud, *Combustion and Flame* 2022, DOI 10.1016/j.combustflame.2022.112078 | Data assimilation + mô hình vật lý cho lan truyền lửa concurrent | Thí nghiệm vi trọng lực trên mẫu cellulose mỏng (drop tower NASA GRC) — **không phải** BASS-II/SAFFIRE | Không thấy mã công khai | **Research paper only** |
| **Data driven forecast of droplet combustion** — *Proc. Combust. Inst.* 38 (2021), DOI 10.1016/j.proci.2020.05.012 (Spalding + số hóa pha khí, khởi tạo bằng dữ liệu hình học ngọn lửa/regression rate) | Hybrid cho giọt vi trọng lực — rất gần FLEX | Trang tóm tắt không nêu FLEX | Không thấy mã | **Research paper only** |
| Xi, *Data Driven Forecast for Fire* (luận án UCL 2023) | Mở rộng hai bài trên | – | – | Research only |
| ROM POD + neural network cho ngọn lửa khuếch tán methane vi trọng lực (*cjournal.hep.com.cn*, 2026) | Surrogate cho ngọn lửa khí | Mô phỏng CFD, không phải FLEX | Không xác minh | **Relevant model trained on different data** (chi tiết chưa xác minh) |
| MaCFP repository (NIST, GitHub) — dữ liệu PMMA parallel-panel cho kiểm chứng mô hình lửa | Dữ liệu PMMA 1g | – | Dữ liệu công khai, không phải mô hình | Dữ liệu tham khảo |
| **NASA/TP-2015-216046** "Detailed Results from FLEX, March 2009 to December 2011" (Dietrich et al.) — NTRS 20150023456 | **Báo cáo dữ liệu gốc** 284 test FLEX | – | PDF công khai | Nguồn dữ liệu, không phải mô hình — **nên tải về** |
| "Using an ANN to Predict Flame Spread Across Electrical Wires" (chỉ xuất hiện như tiêu đề liên quan) | ML cho lan truyền lửa dây điện | Không rõ | Không xác minh | **Unverified claim** |

Không có kết quả nào cho thấy một challenge Space Apps trước đó đã công bố mô hình trên ba bộ dữ liệu này.

---

## 4. Bảng phân loại cuối cùng

| Phân loại | Mục |
|---|---|
| **Verified pretrained model** (có trọng số, có thể chạy) | Chỉ các mô hình **tổng quát**: SAM 2 (segmentation), các embedding/LLM thương mại hoặc mở. **Không có mô hình nào huấn luyện trên FLEX/BASS-II/SAFFIRE-I.** |
| **Published model without available weights** | SAM 2 + automatic prompt selection (arXiv 2607.16587) — chưa xác nhận phát hành trọng số |
| **Research paper only** | Xi/Torero/Guibaud 2022 (C&F); Data driven forecast of droplet combustion (PCI 2021); Farouk & Dryer sphero-symmetric model (M6); Nayagam AEA (M5); Olson energy balance (M10); Bhattacharjee Vg,cr (M8); de Ris/thermal regime (M9); Dembia et al. image analysis (M15) |
| **Relevant model trained on different data** | SAM 2; ROM POD+NN cho ngọn lửa methane vi trọng lực; mọi mô hình flame spread/wildfire 1g |
| **Unverified claim** | ANN dự đoán lan truyền lửa trên dây điện (không mở được toàn văn); chi tiết ROM 2026 |

---

## 5. Hệ quả cho SpaceFire AI

1. **Không có gì để "fine-tune" hay tái sử dụng trực tiếp** cho dự đoán; mọi mô hình phải được xây từ đầu trên dữ liệu nhỏ → ưu tiên mô hình vật lý + thống kê minh bạch.
2. **Điểm mới (novelty) thực sự có thể có:** (a) hệ thống truy xuất bằng chứng có kiểm chứng số liệu cho dữ liệu vi trọng lực NASA; (b) bảng dữ liệu chuẩn hóa có cờ chất lượng — bản thân đây là đóng góp mà chưa thấy ai công bố; (c) baseline physics-informed (d²-law + hồi quy K) được đánh giá trung thực.
3. **Tương lai (sau hackathon):** áp dụng SAM 2 / phương pháp của arXiv 2607.16587 lên ảnh FLEX/SAFFIRE thật để tạo dữ liệu D(t), Df(t), vị trí mép lửa; data assimilation kiểu Xi & Torero cho dự báo lan truyền lửa.

---

## Nguồn web
- [NTRS 20150023456 — Detailed Results from the Flame Extinguishment Experiment (FLEX)](https://ntrs.nasa.gov/citations/20150023456)
- [arXiv:2607.16587 — Digital measurement of droplet flame diameter … SAM 2](https://arxiv.org/abs/2607.16587)
- [Data driven forecast of concurrent flame spread in micro-gravity (Bohrium)](https://www.bohrium.com/paper-details/data-driven-forecast-of-concurrent-flame-spread-in-micro-gravity/812788805923766273-3804)
- [UCL Discovery — bản thảo Data Driven Forecast of Concurrent Flame Spread](https://discovery.ucl.ac.uk/10145279/1/Data%20Driven%20Forecast%20of%20Concurrent%20Flame%20Spread_uploaded.pdf)
- [Data driven forecast of droplet combustion (ANID record)](https://investigadores.anid.cl//en/public_search/work?id=651953)
- [Springer — Droplet Combustion Experiments Aboard the ISS](https://link.springer.com/doi/10.1007/s12217-014-9372-2)
- [NTRS 20130014061 — Methanol Droplet Combustion in Oxygen-Inert Environments](https://ntrs.nasa.gov/citations/20130014061)
- [cjournal.hep.com.cn — ROM POD + NN microgravity flames](https://cjournal.hep.com.cn/1006-8740/CN/PDF/Y2026/V32/I1/59)
- [The Application of Flame Spread Theory to Predict Material Performance (NCBI PMC) — kết quả tìm kiếm có nhắc dữ liệu PMMA của NIST trên MaCFP repo](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5178311/)
- [UCL Discovery — SIBAL cotton concurrent flame spread (Saffire & BASS)](https://discovery.ucl.ac.uk/id/eprint/10164340/1/SIBAL-cotton%20revised%20Sept%20per%20review%20track%20changes%20accepted.pdf)
