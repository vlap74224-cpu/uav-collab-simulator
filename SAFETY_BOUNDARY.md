# 无人机障碍物安全边界

本模拟器不把固定的 5 m / 15 m 当作通用法规距离。民航行业标准 MH/T 1069—2018 第 4.3.2.4 条要求根据无人机尺寸、重量、飞行速度和环境条件确定与障碍物之间的必要安全距离。

当前界面以 DJI Mavic 3E/3M 为性能参考：

- Mavic 3E 正常模式最大水平速度 15 m/s，前向探测范围 0.5–200 m，前向有效感知速度不高于 15 m/s。
- DJI 手册要求运动模式在无风条件下至少保留 30 m 水平制动距离；正常或运动模式升降时至少保留 10 m 制动距离。
- DJI Pilot 2 允许分别设置预警距离和制动距离；水平障碍物进入 16 m 显示范围后，根据所设阈值显示绿、橙、红。

## 模拟器计算方法

水平红色制动线以 `30 m @ 21 m/s` 为基准，按相同制动能力下停止距离与速度平方成正比计算：

```text
d_brake = max(5, 30 × (v / 21)²)
d_warning = max(16, d_brake + v)
```

其中 `v` 是当前水平速度，单位为 m/s。橙色预警线在制动线之外再保留约 1 秒当前速度对应的行程，并且不低于 16 m。绿色表示大于预警线，橙色表示在预警线内但尚未进入制动线，红色表示已经进入制动线。

垂直方向在升降时采用 10 m 红色制动线；未升降时保留 3 m 近体净距，并以 10 m 作为预警线。移动交通目标采用本机速度与目标速度相加的保守闭合速度计算。

当前默认计划速度 12 m/s 时：红色不大于 9.8 m，橙色不大于 21.8 m，绿色大于 21.8 m。该模型用于实验界面和告警逻辑，不构成真实飞行放行或适航依据。

## 官方来源

- 中国民用航空局，MH/T 1069—2018《无人驾驶航空器系统作业飞行技术规范》：https://www.caac.gov.cn/PHONE/XXGK_17/XXGK/BZGF/HYBZ/201904/P020240719361941543191.pdf
- DJI Mavic 3 Enterprise 规格：https://enterprise.dji.com/mavic-3-enterprise/specs
- DJI Mavic 3 Enterprise Series User Manual：https://dl.djicdn.com/downloads/DJI_Mavic_3_Enterprise/20250916/DJI_Mavic_3_Enterprise_Series_User_Manual_EN.pdf
- DJI Mavic 3M User Manual：https://dl.djicdn.com/downloads/DJI_Mavic_3_Enterprise/20240814/DJI_Mavic_3M_User_Manual_EN.pdf
