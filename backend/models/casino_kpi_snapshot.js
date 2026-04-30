const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const CasinoKpiSnapshot = sequelize.define(
        'CasinoKpiSnapshot',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            key: { type: DataTypes.STRING, allowNull: false },
            brand: { type: DataTypes.STRING, allowNull: false },
            metric: { type: DataTypes.STRING, allowNull: false },
            unit: { type: DataTypes.STRING, allowNull: false },
            value: { type: DataTypes.DECIMAL(20, 4), allowNull: true },
            previous: { type: DataTypes.DECIMAL(20, 4), allowNull: true },
            spark: { type: DataTypes.TEXT, allowNull: true },
            card_id: { type: DataTypes.INTEGER, allowNull: true },
            captured_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
            },
            error: { type: DataTypes.TEXT, allowNull: true },
        },
        {
            tableName: 'casino_kpi_snapshots',
            indexes: [{ fields: ['key', 'captured_at'] }],
        }
    );

    return CasinoKpiSnapshot;
};
